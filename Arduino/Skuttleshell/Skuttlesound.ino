// Skuttlesound.cpp
#include "Skuttlesound.h"
#include "driver/i2s.h"
#include "esp_heap_caps.h"


#define I2S_PORT I2S_NUM_1
#define BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_16BIT

#define SAMPLE_RATE 16000
#define I2S_BUFFER_SIZE   1024 //max allowed size
#define CIRCULAR_BUFFER_SIZE (I2S_BUFFER_SIZE * 8) 
#define FLASHLIGHT 4

uint8_t* circularBuffer = nullptr;
size_t writeIndex = 0;  // Where to write incoming data
size_t readIndex = 0;   // Where to read data to play
size_t availableAudio = 0;  // Amount of audio data available in the buffer
const int audioStackSize=16384;
bool paused = false;
extern bool ENDAUDIO;

Skuttlesound::Skuttlesound() {}

void Skuttlesound::begin() {
    
    circularBuffer = (uint8_t*) malloc(CIRCULAR_BUFFER_SIZE);
    if (!circularBuffer) {
      Serial.println("Failed to allocate audio buffer in local RAM");
      return;
    }
    Serial.println("Audio buffer allocated in local RAM");
    //}
  // Setup I2S config for using with MAX98357A
  i2s_config_t i2s_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
      .sample_rate = SAMPLE_RATE, // Use defined constant
      .bits_per_sample = BITS_PER_SAMPLE, // Use defined constant
      .channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 8,//was 8
      .dma_buf_len = I2S_BUFFER_SIZE,
      .use_apll = false, //special clock
      .tx_desc_auto_clear = true // Avoids noise in case of underflow
  };

  const i2s_pin_config_t pin_config = {
      .bck_io_num = 14, // BLCK
      .ws_io_num = 2, // LRC
      .data_out_num = 15, // DIN 
      .data_in_num = I2S_PIN_NO_CHANGE
  };

  // Install and start I2S driver
  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
      Serial.printf("Failed to install I2S driver: %d\n", err);
      return;
  }
  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
      Serial.printf("Failed to set I2S pins: %d\n", err);
      return;
  }

  Serial.println("Audio Systems Online"); 
  bufferMutex = xSemaphoreCreateMutex();

  xTaskCreatePinnedToCore(
    audioTask, // Task function
    "AudioTask",         // Name of the task
    audioStackSize,      // Stack size in words
    this,                // Pass the instance of Skuttlesound for context
    8,                   // Priority of the task
    &audioTaskHandle,                // Task handle
    1);                  // Core ID (0 or 1, tskNO_AFFINITY for no affinity)
  Serial.println("Audio Core Set"); 

  xTaskCreatePinnedToCore(
      audioReport,          // Task function
      "Audio Stack Report", // Task name
      2048,                 // Stack size
      this,                 // Parameters (passing the class instance)
      1,                    // Priority
      NULL,                 // Task handle not stored
      0                     // Core
  );
}

// Implementation of the static task function
void Skuttlesound::audioTask(void *pvParameters) {
  // Cast the void pointer back to Skuttlesound instance
  Skuttlesound* soundInstance = static_cast<Skuttlesound*>(pvParameters);
  for (;;) {
      // Since play is now a static function, pass the instance to it
      soundInstance->processAudio();
      vTaskDelay(pdMS_TO_TICKS(10)); // Adjust the delay as needed for your application 
  }
}

void Skuttlesound::processAudio() { // Sends to the i2s for playback called by audiotask
    if (xSemaphoreTake(bufferMutex, portMAX_DELAY)) {
        if (availableAudio >= I2S_BUFFER_SIZE || (ENDAUDIO && availableAudio > 0)) {//if we have a full packet, or we have a smaller packet but are in endaudiomode
            size_t bytesToWrite = min(static_cast<size_t>(I2S_BUFFER_SIZE), availableAudio);
            size_t endIndex = (readIndex + bytesToWrite) % CIRCULAR_BUFFER_SIZE;
            size_t bytes_written = 0;

            if (endIndex < readIndex) { // Wrap around case
                size_t firstChunkSize = CIRCULAR_BUFFER_SIZE - readIndex;
                size_t secondChunkSize = endIndex;
                //write first chunk
                esp_err_t result = i2s_write(I2S_PORT, &circularBuffer[readIndex], firstChunkSize, &bytes_written, portMAX_DELAY);
                if (result != ESP_OK || bytes_written != firstChunkSize) {
                    Serial.printf("Error in i2s_write: %d, Bytes written: %d\n", result, bytes_written);
                }
                //writes the second chunk
                result = i2s_write(I2S_PORT, &circularBuffer[0], secondChunkSize, &bytes_written, portMAX_DELAY);
                if (result != ESP_OK || bytes_written != secondChunkSize) {
                    Serial.printf("Error in i2s_write: %d, Bytes written: %d\n", result, bytes_written);
                }
            } else {//normal case
                esp_err_t result = i2s_write(I2S_PORT, &circularBuffer[readIndex], bytesToWrite, &bytes_written, portMAX_DELAY);
                if (result != ESP_OK || bytes_written != bytesToWrite) {
                    Serial.printf("Error in i2s_write: %d, Bytes written: %d\n", result, bytes_written);
                }
            }

            readIndex = endIndex;
            availableAudio -= bytesToWrite;
           
            if (ENDAUDIO && availableAudio <= 0) {//we have exhaused the buffer
              //ENDAUDIO = false;
              writeIndex = 0;
              readIndex = 0;
              availableAudio = 0;
              bufferUsage=0;
              memset(circularBuffer, 0, CIRCULAR_BUFFER_SIZE); // Clear the buffer
              Serial.println("Buffer cleared and indices reset.");
            }
        }
        xSemaphoreGive(bufferMutex);
    }
}

void Skuttlesound::addToBuffer(const uint8_t* data, size_t len) {
  receivedDataSize += len; // Track the amount of data received
  if (xSemaphoreTake(bufferMutex, portMAX_DELAY)) { // Take the mutex
    for (size_t i = 0; i < len; i += 2) {
      if (availableAudio < CIRCULAR_BUFFER_SIZE - 1) { // Ensure there is enough space for 16-bit samples
        circularBuffer[writeIndex] = data[i];
        circularBuffer[(writeIndex + 1) % CIRCULAR_BUFFER_SIZE] = data[i + 1];
        writeIndex = (writeIndex + 2) % CIRCULAR_BUFFER_SIZE;
        availableAudio += 2;
      } else {
        Serial.println("Warning: Circular buffer overflow");  //abort!
        break;
      }
    }
   if(!ENDAUDIO){ // if there has been no indicator of end of data
      wsSound.textAll("READY");
      Serial.println("Ready");     
    } 

    bufferUsage = (float)availableAudio / CIRCULAR_BUFFER_SIZE;
    if(paused&&(bufferUsage<=.5)){
        paused=false;
        wsSound.textAll("RESUME");
        Serial.println("Buffer has space, sent RESUME command to client.");
        //wsSound.textAll("READY");
        //Serial.println("Ready");   

    }else if(!paused&&(bufferUsage>=.8)){
        paused=true;            
        wsSound.textAll("PAUSE");
        Serial.println("Buffer nearing capacity.");
    }
    xSemaphoreGive(bufferMutex); // Give the mutex
  }
}

void Skuttlesound::audioReport(void *pvParameters) {
    Skuttlesound* instance = static_cast<Skuttlesound*>(pvParameters);
    while (true) {
        instance->receptionRate = (instance->receivedDataSize / 3.0) / 1024.0; // Since vTaskDelay is 3000 ms, divide by 3 to get bytes per second
        instance->receivedDataSize = 0; // Reset the counter for the next interval
        UBaseType_t stackHighWaterMark = uxTaskGetStackHighWaterMark(instance->audioTaskHandle);
        float usedStackPercentage = 100.0 - ((float)stackHighWaterMark / audioStackSize) * 100;
        String command = "Audio Stack(%): " + String(usedStackPercentage, 2)+
         ", Reception Rate (kbps): " + String(instance->receptionRate, 2) +", Device Buffer Usage(%): " + String(instance->bufferUsage * 100, 2);
        Serial.println(command);
        wsCommand.textAll(command);
        vTaskDelay(pdMS_TO_TICKS(3000));
    }
}
