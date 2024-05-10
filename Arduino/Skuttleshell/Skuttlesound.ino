// Skuttlesound.cpp
#include "Skuttlesound.h"
#include "driver/i2s.h"

#include "esp_heap_caps.h"

#define I2S_PORT I2S_NUM_1
#define SAMPLE_RATE 44100
#define BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_16BIT
#define BUFFER_SIZE 88200  //1 second
#define CHUNKSIZE 8820 // .1 second
#define PACKETSIZE

uint8_t* audioBuffer = nullptr;
size_t writeIndex = 0;  // Where to write incoming data
size_t readIndex = 0;   // Where to read data to play

Skuttlesound::Skuttlesound() {}

void Skuttlesound::begin() {
      if (psramFound()) {
        audioBuffer = (uint8_t*) heap_caps_malloc(BUFFER_SIZE, MALLOC_CAP_SPIRAM);
        if (!audioBuffer) {
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
      .dma_buf_count = 12,//was 8
      .dma_buf_len = 128,//was 64
      .use_apll = true,
      .tx_desc_auto_clear = true // Avoids noise in case of underflow
  };

  const i2s_pin_config_t pin_config = {
      .bck_io_num = 2, // BCKL
      .ws_io_num = 14, // LRCL
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
}

void Skuttlesound::play() {
  //Serial.println("Attempting to play buffer");
  // Only proceed if there's enough data to play
  if (availableAudio >= CHUNKSIZE) {
    Serial.println(".");
    uint8_t tempBuffer[CHUNKSIZE] = {0}; // Temporary buffer for data to play
    
    // Fill tempBuffer with available audio data
    for (size_t i = 0; i < CHUNKSIZE; ++i) {
      tempBuffer[i] = audioBuffer[readIndex];
      availableAudio--;
      readIndex = (readIndex + 1) % BUFFER_SIZE;
    }
    // Play the chunk
    size_t bytes_written = 0;
    esp_err_t result = i2s_write(I2S_PORT, tempBuffer, CHUNKSIZE, &bytes_written, portMAX_DELAY);

    // Check the result and bytes_written for diagnostics
    if (result != ESP_OK) {
        Serial.printf("i2s_write failed: %d\n", result);
    }
    if (bytes_written != CHUNKSIZE) {
      Serial.printf("i2s_write incomplete: %d/%d bytes\n", bytes_written, CHUNKSIZE);
    }
  } else {
    //Serial.println("Not enough data to play");
    // Optional: Handle underflow, e.g., by waiting or inserting silence
  }
}

void Skuttlesound::addToBuffer(const uint8_t* data, size_t len) {
  //Serial.print ("Adding to buffer: ");
  for (size_t i = 0; i < len; ++i) {
    if (availableAudio < BUFFER_SIZE) {
        audioBuffer[writeIndex] = data[i];
        writeIndex = (writeIndex + 1) % BUFFER_SIZE;
        availableAudio++;
    }
  }
  delay(1);
  //Serial.println ("Added to buffer: " +String(availableAudio));
  play();
}