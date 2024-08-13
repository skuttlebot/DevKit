#ifndef SBBLUE_H
#define SBBLUE_H

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <driver/i2s.h>

class SBBlue {
public:
    SBBlue();
    void begin(const char* deviceName);
    void startAudioTask(); // Start the Bluetooth audio processing task
    static void audioTask(void *pvParameters); // Task function
    static void audioReport(void *pvParameters); // Report task function

private:
    BluetoothSerial btSerial;
    TaskHandle_t audioTaskHandle;
    TaskHandle_t reportTaskHandle; // Handle for the report task
    uint32_t receivedDataSize = 0; // To track the amount of data received
    float receptionRate = 0; // To store the reception rate (bps)
    void i2sInit();
    void processAudio(); // Process audio data from Bluetooth
    void processAudioData(const uint8_t* data, size_t len);
};

#endif // SBBLUE_H
