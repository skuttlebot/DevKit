//Skuttlecam handles camera functions
#include "Skuttlecam.h"
#include <esp_camera.h>
#define CAMERA_MODEL_AI_THINKER  // Has PSRAM
#include "camera_pins.h"
#include "camera_index.h"
extern AsyncWebSocket wsCamera;
extern AsyncWebSocket wsCommand;
bool CAMINIT=false;

Skuttlecam::Skuttlecam() {
    fb = nullptr;            // Initialize fb in the constructor
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
  esp_camera_fb_return(fb);

  // Initialize the camera
  Serial.println("Starting init");
  esp_err_t err = esp_camera_init(&config);
  Serial.println("finished init");
  //delay(2000);
  if (err != ESP_OK) {
    Serial.printf("Camera initialization failed with error 0x%x", err);
    return;
  } else if (err ==ESP_OK) {
      Serial.println("Camera initialized");
      CAMINIT=true;
  }else{Serial.println("cam awol");
  }

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
}

void Skuttlecam::off() {
  //esp_camera_deinit();
  String msg ="I've turned the camera off!";
  Serial.println(msg);
  wsCommand.textAll(msg);
  esp_camera_fb_return(fb);
  if (fb != nullptr) {
    esp_camera_fb_return(fb);
    fb = nullptr;       // Set fb to nullptr after returning the frame buffer
  }
  cameraClientId=0;
  CAMINIT=false;
}
void Skuttlecam::data() 
{
    if (cameraClientId == 0 || !CAMINIT)
    {
      return;
    }
    //Serial.println(cameraClientId);
    //heap_caps_malloc_extmem_enable(20000);
    //unsigned long  startTime1 = millis();
    //capture a frame
    //Serial.printf("Free heap before acquiring frame: %d\n", ESP.getFreeHeap());
    camera_fb_t *fb = esp_camera_fb_get();
    //Serial.printf("Free heap after acquiring frame: %d\n", ESP.getFreeHeap());
    if (!fb) 
    {
        Serial.println("Frame buffer could not be acquired");
        return;
    }

    unsigned long  startTime2 = millis();
    //const String blobType = "video/mjpg";  // Replace with the actual Blob type
    
    wsCamera.binary(cameraClientId, fb->buf, fb->len);
    
      
    //Wait for message to be delivered
    while (true)
    {
      AsyncWebSocketClient * clientPointer = wsCamera.client(cameraClientId);
      if (!clientPointer || !(clientPointer->queueIsFull()))
        {break;}

      //Serial.print("+");
      if (millis() - startTime2 > 5000)
        {
        Serial.println("WebSocket message delivery timeout");
        break;
        }
      delay(1);
    }
    esp_camera_fb_return(fb);
    
}