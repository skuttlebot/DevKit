// Skuttlesound.h
#ifndef Skuttlesound_h
#define Skuttlesound_h
#include "Arduino.h"

class Skuttlesound {
private:
    static void play(void *instance); // Make play a static function to be compatible with FreeRTOS task creation

    //uint8_t* audioBuffer = nullptr; // Pointer for dynamic audio buffer allocation
    //size_t writeIndex = 0;          // Where to write incoming data
    //size_t readIndex = 0;           // Where to read data to play
    //volatile size_t availableAudio = 0;

public:
  Skuttlesound();
  void begin();  // Initialize I2S audio output
  //void play(); // Play sound via I2S
  void addToBuffer(const uint8_t* data, size_t len); 
  void processAudio();
  static void audioTask(void *pvParameters); // Task function declaration
};

#endif
