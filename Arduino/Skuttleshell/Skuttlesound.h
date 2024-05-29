// Skuttlesound.h
#ifndef Skuttlesound_h
#define Skuttlesound_h
#include "Arduino.h"

class Skuttlesound {
private:
    static void play(void *instance); // Make play a static function to be compatible with FreeRTOS task creation
    static const int SAMPLE_RATE = 44100;
    static const size_t BUFFER_SIZE = 22050;  // .25 second of audio
    static const size_t CHUNKSIZE = 2205;     // .025 second of audio
    uint8_t* audioBuffer = nullptr; // Pointer for dynamic audio buffer allocation
    size_t writeIndex = 0;          // Where to write incoming data
    size_t readIndex = 0;           // Where to read data to play
    volatile size_t availableAudio = 0;

public:
  Skuttlesound();
  void begin();  // Initialize I2S audio output
  void play(); // Play sound via I2S
  void addToBuffer(const uint8_t* data, size_t len); 
  void processBuffer();
  static void AudioProcessingTask(void *pvParameters); // Task function declaration
};

#endif
