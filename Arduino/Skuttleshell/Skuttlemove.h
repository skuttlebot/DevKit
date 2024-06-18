// Skuttlemove.h
#pragma once
#include <Arduino.h>

class Skuttlemove {
public:
    Skuttlemove();
    void setup();
    void action(bool COMMAND[], float MOVE[]);

private:
    static void moveTask(void *pvParameters);
    void executeMovement();
};
