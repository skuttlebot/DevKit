// Skuttlesound.h
#ifndef Skuttlesound_h
#define Skuttlesound_h
#include "Arduino.h"

class Skuttlesound {
private:
    static void play(void *instance); // Make play a static function to be compatible with FreeRTOS task creation
    SemaphoreHandle_t bufferMutex;
    size_t receivedDataSize = 0;  // Total size of data received in the current interval
    float receptionRate = 0;      // Data reception rate (bytes per second)

public:
  Skuttlesound();
  void begin();  // Initialize I2S audio output
  //void play(); // Play sound via I2S
  void addToBuffer(const uint8_t* data, size_t len); 
  void processAudio();
  void handleEndOfAudio();
  static void audioTask(void *pvParameters); // Task function declaration
  static void audioReport(void *pvParameters);
  static void bufferMonitorTask(void *pvParameters); 
  TaskHandle_t audioTaskHandle;

};

#endif
