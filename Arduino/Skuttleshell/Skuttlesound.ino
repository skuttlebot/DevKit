// Skuttlesound.cpp
#include "Skuttlesound.h"
#include "driver/i2s.h"
#include "esp_heap_caps.h"
//#include "BluetoothA2DPSource.h" //bt add

#define I2S_PORT I2S_NUM_1
#define BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_16BIT

#define SAMPLE_RATE 16000
#define I2S_BUFFER_SIZE   1024
#define CIRCULAR_BUFFER_SIZE (I2S_BUFFER_SIZE * 4) 



uint8_t* circularBuffer = nullptr;
size_t writeIndex = 0;  // Where to write incoming data
size_t readIndex = 0;   // Where to read data to play
size_t availableAudio = 0;  // Amount of audio data available in the buffer



Skuttlesound::Skuttlesound() {}

void Skuttlesound::begin() {
      if (psramFound()) {
        circularBuffer = (uint8_t*) heap_caps_malloc(CIRCULAR_BUFFER_SIZE, MALLOC_CAP_SPIRAM);
        if (!circularBuffer) {
            Serial.println("Failed to allocate audio buffer in PSRAM");
            return;
        }
        Serial.println("Audio buffer allocated in PSRAM");
    } else {
        Serial.println("PSRAM not found, audio buffering may be limited.");
    }
  // Setup I2S config for using with MAX98357A
  i2s_config_t i2s_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
      .sample_rate = SAMPLE_RATE, // Use defined constant
      .bits_per_sample = BITS_PER_SAMPLE, // Use defined constant
      .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 4,//was 8
      .dma_buf_len = I2S_BUFFER_SIZE,
      .use_apll = false, //special clock
      .tx_desc_auto_clear = true // Avoids noise in case of underflow
  };

  const i2s_pin_config_t pin_config = {
      .bck_io_num = 2, // BLCK
      .ws_io_num = 14, // LRC
      .data_out_num = 4, // DIN 
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
  xTaskCreatePinnedToCore(
    audioTask, // Task function
    "AudioTask",         // Name of the task
    4096,                // Stack size in words
    this,                // Pass the instance of Skuttlesound for context
    3,                   // Priority of the task
    NULL,                // Task handle
    0);                  // Core ID (0 or 1, tskNO_AFFINITY for no affinity)
  Serial.println("Audio Core Set");   
}

// Implementation of the static task function
void Skuttlesound::audioTask(void *pvParameters) {
  // Cast the void pointer back to Skuttlesound instance
  Skuttlesound* soundInstance = static_cast<Skuttlesound*>(pvParameters);
  for (;;) {
      // Since play is now a static function, pass the instance to it
      //play(soundInstance);
      soundInstance->processAudio();
      vTaskDelay(pdMS_TO_TICKS(10)); // Adjust the delay as needed for your application 
  }
}

// Adjusted play method to be static and accept a Skuttlesound instance pointer
/*void Skuttlesound::play(void *instance) {
    auto* self = static_cast<Skuttlesound*>(instance); // Cast back to Skuttlesound instance

    // Ensure there's enough data to play
    if (self->availableAudio >= I2S_BUFFER_SIZE) {
        Serial.println(".");
        uint8_t tempBuffer[I2S_BUFFER_SIZE] = {0}; // Temporary buffer for data to play

        // Fill tempBuffer with available audio data
        for (size_t i = 0; i < I2S_BUFFER_SIZE; ++i) {
            tempBuffer[i] = self->audioBuffer[self->readIndex];
            self->availableAudio--;
            self->readIndex = (self->readIndex + 1) %CIRCULAR_BUFFER_SIZE;
        }

        // Play the chunk
        size_t bytes_written = 0;
        esp_err_t result = i2s_write(I2S_PORT, tempBuffer, I2S_BUFFER_SIZE, &bytes_written, portMAX_DELAY);

        // Check the result and bytes_written for diagnostics
        if (result != ESP_OK) {
            Serial.printf("i2s_write failed: %d\n", result);
        }
        if (bytes_written != I2S_BUFFER_SIZE) {
            Serial.printf("i2s_write incomplete: %d/%d bytes\n", bytes_written, I2S_BUFFER_SIZE);
        }

    }
}*/

void Skuttlesound::processAudio() {  //sends to the i2s for playback
    if (availableAudio >= I2S_BUFFER_SIZE) {
        uint8_t tempBuffer[I2S_BUFFER_SIZE] = {0};

        for (size_t i = 0; i < I2S_BUFFER_SIZE; ++i) {
            tempBuffer[i] = circularBuffer[readIndex];
            availableAudio--;
            readIndex = (readIndex + 1) %CIRCULAR_BUFFER_SIZE;
        }

        size_t bytes_written = 0;
        esp_err_t result = i2s_write(I2S_PORT, tempBuffer, I2S_BUFFER_SIZE, &bytes_written, portMAX_DELAY);

        if (result != ESP_OK) {
            Serial.printf("i2s_write failed: %d\n", result);
        }
        if (bytes_written != I2S_BUFFER_SIZE) {
            Serial.printf("i2s_write incomplete: %d/%d bytes\n", bytes_written, I2S_BUFFER_SIZE);
        }
    }
}

void Skuttlesound::addToBuffer(const uint8_t* data, size_t len) {//writes the data to the circular buffer
  //Serial.print ("Adding to buffer: ");
  for (size_t i = 0; i < len; ++i) {
    if (availableAudio <CIRCULAR_BUFFER_SIZE) {
        circularBuffer[writeIndex] = data[i];
        writeIndex = (writeIndex + 1) %CIRCULAR_BUFFER_SIZE;
        availableAudio++;
    }
  }
    //delay(1);
    // Only proceed if there's enough data to play
  //if (availableAudio >= I2S_BUFFER_SIZE) {play();} function move to task
}


/*void Skuttlesound::play() {
//Serial.println("Attempting to play buffer");

  Serial.println(".");
  uint8_t tempBuffer[I2S_BUFFER_SIZE] = {0}; // Temporary buffer for data to play
  
  // Fill tempBuffer with available audio data
  for (size_t i = 0; i < I2S_BUFFER_SIZE; ++i) {
    tempBuffer[i] = audioBuffer[readIndex];
    availableAudio--;
    readIndex = (readIndex + 1) %CIRCULAR_BUFFER_SIZE;
  }
  // Play the chunk
  size_t bytes_written = 0;
  esp_err_t result = i2s_write(I2S_PORT, tempBuffer, I2S_BUFFER_SIZE, &bytes_written, portMAX_DELAY);

  // Check the result and bytes_written for diagnostics
  if (result != ESP_OK) {
      Serial.printf("i2s_write failed: %d\n", result);
  }
  if (bytes_written != I2S_BUFFER_SIZE) {
    Serial.printf("i2s_write incomplete: %d/%d bytes\n", bytes_written, I2S_BUFFER_SIZE);
  }
} /*else {
  //Serial.println("Not enough data to play");
  // Optional: Handle underflow, e.g., by waiting or inserting silence
}*/



