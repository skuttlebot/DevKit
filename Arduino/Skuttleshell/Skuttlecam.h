// Skuttlecam.h

#pragma once

#include <esp_camera.h>
extern int cameraClientId;
extern AsyncWebSocket wsCamera;  
extern AsyncWebSocket wsCommand;
extern bool CAMINIT;


class Skuttlecam {
private:
    camera_fb_t *fb;
           


public:
    Skuttlecam();             
    void on();
    void off();
    static void camTask(void *pvParameters);
    static void camReport(void *pvParameters);
    TaskHandle_t camTaskHandle;  // Task handle as a member variable 
    //void camTask();
};
