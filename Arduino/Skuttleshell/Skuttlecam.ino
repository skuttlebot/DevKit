//Skuttlecam handles camera functions
#include "Skuttlecam.h"
#include <esp_camera.h>
#define CAMERA_MODEL_AI_THINKER  // Has PSRAM
#include "camera_pins.h"
#include "camera_index.h"

extern AsyncWebSocket wsCamera;
extern AsyncWebSocket wsCommand;
bool CAMINIT=false;
const int camStackSize=4096;

Skuttlecam::Skuttlecam() {
    fb = nullptr;            // Initialize fb in the constructor
}

void Skuttlecam::camTask(void *pvParameters) {
  Skuttlecam *camera = static_cast<Skuttlecam *>(pvParameters);  // Get the Skuttlecam instance
  while(true){
    if (cameraClientId == 0 || !CAMINIT){//punt 
    }else{
      camera_fb_t *fb = esp_camera_fb_get();
      if (!fb) {//if we didnt get a fram
        Serial.println("Frame buffer could not be acquired");
      }else{ //we did!
        unsigned long  startTime = millis();
        //const String blobType = "video/mjpg";  // Replace with the actual Blob type
        wsCamera.binary(cameraClientId, fb->buf, fb->len);
        //Wait for message to be delivered
        while (true){
          AsyncWebSocketClient * clientPointer = wsCamera.client(cameraClientId);
          if (!wsCamera.client(cameraClientId)->queueIsFull()) {break;}//if there is a client and the queue isnt full
          Serial.print("+");
          if (millis() - startTime > 5000){
            Serial.println("WebSocket message delivery timeout");
            break;
          }
          yield();
        }
        esp_camera_fb_return(fb);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20)); // Adjust the delay as needed
  }
}

void Skuttlecam::on() {
  String msg = "Starting camera";
  Serial.println(msg);
  //wsCommand.textAll(msg);
  camera_config_t config;
  //cam to ship details
  config.ledc_channel = LEDC_CHANNEL_4;//not sure how this links
  config.ledc_timer = LEDC_TIMER_2;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_VGA;
  config.pixel_format = PIXFORMAT_JPEG; // for streaming
  //config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 25;  //higher is lower quality
  config.fb_count = 1;
  //fesp_camera_fb_return(fb);

  if(psramFound()){
    Serial.println("PSRAM Found!!!");
    heap_caps_malloc_extmem_enable(20000);  
    Serial.println("PSRAM initialized. malloc to take memory from psram"); 
  } else {
    // Limit the frame size when PSRAM is not available
    Serial.println("No PSRAM... sad.");
    config.frame_size = FRAMESIZE_VGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
    delay(100);
  }
    // Initialize the camera
  Serial.println("Starting init");
  esp_err_t err = esp_camera_init(&config);
  Serial.println("finished init");
  //delay(2000);
  if (err != ESP_OK) {
    Serial.printf("Camera initialization failed with error 0x%x", err);
    return;
  } else {
      Serial.println("Camera initialized");
      CAMINIT=true;
  }

   xTaskCreatePinnedToCore(
    camTask,          //task function
    "CameraTask",     //task name
    camStackSize,             //stack size
    this,             //params
    2,                //priority
    &camTaskHandle,             //task handle 
    0                 //core (0 or 1)
  );

  xTaskCreatePinnedToCore(
    camReport,          //task function
    "Camera Stack Report",     //task name
    2048,             //stack size
    this,             //params
    1,                //priority
    NULL,             //task handle 
    0                 //core (0 or 1)
  );
}

void Skuttlecam::camReport(void*pvParameters){
  Skuttlecam* cam = static_cast<Skuttlecam*>(pvParameters);  // Correctly cast the parameter to Skuttlecam instance
  while(true){
    UBaseType_t camStackHighWaterMark = uxTaskGetStackHighWaterMark(cam->camTaskHandle);
    float usedCamStackPercentage = 100.0 - ((float)(camStackHighWaterMark) / camStackSize) * 100;
    // Create the command string
    String command = " Cam Stack(%): " + String(usedCamStackPercentage, 2);
    Serial.println(command);
    wsCommand.textAll(command);
    vTaskDelay(pdMS_TO_TICKS(3000));
  }
}

void Skuttlecam::off() {
  String msg = "I've turned the camera off!";
  Serial.println(msg);
  wsCommand.textAll(msg);  

  // Stop the camTask and camReport tasks
  if (camTaskHandle != NULL) {
    Serial.println("Stopping camTask...");
    vTaskDelete(camTaskHandle);
    camTaskHandle = NULL;
  } else {
    Serial.println("camTaskHandle is NULL");
  }

  // Return the frame buffer if it is not null
  if (fb != nullptr) {
    Serial.println("Returning frame buffer...");
    esp_camera_fb_return(fb);
    fb = nullptr; // Set fb to nullptr after returning the frame buffer
  } else {
    Serial.println("fb is NULL");
  }

  // Deinitialize the camera
  Serial.println("Deinitializing camera...");
  esp_err_t err = esp_camera_deinit();
  if (err != ESP_OK) {
    Serial.printf("Camera deinitialization failed with error 0x%x\n", err);
  } else {
    Serial.println("Camera deinitialized successfully");
    CAMINIT = false;
  }
}

