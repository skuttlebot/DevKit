#include "SBBlue.h"
// I want to remove this sbblue

SBBlue::SBBlue() : audioTaskHandle(nullptr), reportTaskHandle(nullptr) {}

void SBBlue::begin(const char* deviceName) {
    btSerial.begin(deviceName);
    Serial.print("Free heap after Bluetooth init: ");
    Serial.println(ESP.getFreeHeap());
    Serial.print("Free PSRAM after Bluetooth init: ");
    Serial.println(ESP.getFreePsram());
    i2sInit();
    Serial.print("Free heap after i2s init: ");
    Serial.println(ESP.getFreeHeap());
    Serial.print("Free PSRAM after i2s init: ");
    Serial.println(ESP.getFreePsram());
    /*//startAudioTask(); // Start the task for processing Bluetooth audio

    // Start the report task
    xTaskCreatePinnedToCore(
        audioReport,          // Task function (now static)
        "AudioReportTask",    // Task name
        2048,                 // Stack size in words
        this,                 // Pass the instance of SBBlue for context
        1,                    // Priority
        &reportTaskHandle,    // Task handle
        0                     // Core ID (0 or 1, tskNO_AFFINITY for no affinity)
    );*/
}

void SBBlue::i2sInit() {
    // Configure the I2S interface
    i2s_config_t i2sConfig = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = 16000, // Same as SkuttleAudio
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 1024, // Same buffer size as SkuttleAudio
        .use_apll = false,
        .tx_desc_auto_clear = true,
        .fixed_mclk = 0
    };

    i2s_pin_config_t pinConfig = {
        .bck_io_num = 14, // BCK pin used in SkuttleAudio
        .ws_io_num = 2,   // WS (LRC) pin used in SkuttleAudio
        .data_out_num = 15, // DATA_OUT pin used in SkuttleAudio
        .data_in_num = I2S_PIN_NO_CHANGE
    };

    i2s_driver_install(I2S_NUM_1, &i2sConfig, 0, NULL); // Using I2S_NUM_1 as in SkuttleAudio
    i2s_set_pin(I2S_NUM_1, &pinConfig);
}

void SBBlue::startAudioTask() {
    BaseType_t result = xTaskCreatePinnedToCore(
        audioTask, // Task function
        "BluetoothAudioTask", // Task name
        16384, // Stack size in words was 8192
        this, // Pass the instance of SBBlue for context
        8, // Priority
        &audioTaskHandle, // Task handle
        0 // Core ID (0 or 1, tskNO_AFFINITY for no affinity)
    );

    if (result != pdPASS) {
        Serial.println("Failed to create audio task!");
    }
}

void SBBlue::audioTask(void *pvParameters) {
    SBBlue* btInstance = static_cast<SBBlue*>(pvParameters);
    for (;;) {
        btInstance->processAudio(); // Continuously process audio data
        vTaskDelay(pdMS_TO_TICKS(1000)); // Adjust the delay as needed
    }
}

void SBBlue::processAudio() {
    if (btSerial.available()) {
        uint8_t buffer[1024];
        size_t len = btSerial.readBytes(buffer, sizeof(buffer));
        processAudioData(buffer, len);
    }
}

void SBBlue::processAudioData(const uint8_t* data, size_t len) {
    size_t bytes_written = 0;
    i2s_write(I2S_NUM_1, data, len, &bytes_written, portMAX_DELAY);
    if (bytes_written != len) {
        Serial.println("Warning: Not all audio data was written to I2S");
    }
}

void SBBlue::audioReport(void *pvParameters) {
    SBBlue* btInstance = static_cast<SBBlue*>(pvParameters);
    while (true) {
        // Calculate reception rate in bytes per second (bps)
        btInstance->receptionRate = (btInstance->receivedDataSize / 3.0) / 1024.0; // Since report is every 3000 ms
        btInstance->receivedDataSize = 0; // Reset the counter for the next interval

        // Check the remaining stack size
        UBaseType_t stackHighWaterMark = uxTaskGetStackHighWaterMark(btInstance->audioTaskHandle);
        float usedStackPercentage = 100.0 - ((float)stackHighWaterMark / 8192) * 100;

        // Create the report string
        String report = "Audio Stack(%): " + String(usedStackPercentage, 2) + 
                        ", Reception Rate (bps): " + String(btInstance->receptionRate, 2);
        Serial.println(report);

        vTaskDelay(pdMS_TO_TICKS(3000)); // Report every 3 seconds
    }
}
