// Skuttlemove.h
#pragma once
#include <Arduino.h>
#include <SkuttleCore.h>

class Skuttlemove {
public:
    Skuttlemove();
    void setup();
    void action(const SkuttleIntent& intent);

private:
    static void moveTask(void *pvParameters);
    void executeMovement();
    void setWheels(float leftSpeed, float rightSpeed);
    void setTilt(int direction);

    float rCurrent;   // slew rate filter: current right speed (-1000 to 1000)
    float lCurrent;   // slew rate filter: current left speed (-1000 to 1000)
    int   tpos;       // current tilt position in SCS steps
};
