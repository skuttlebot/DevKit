// Skuttlemove.ino - Serial bus servo control (Feetech SCS0009)
// Receives a SkuttleIntent; drive mode logic lives in renderer.js on the PC.
// Requires SCServo library from Feetech.
#include "Skuttlemove.h"
#include "config.h"
#include <SCServo.h>

// ─── Serial bus setup ────────────────────────────────────────────────────────
// Half-duplex: wire TX (SERVO_UART_TX) to servo signal line.
// Connect RX (SERVO_UART_RX) to same line via 1kΩ resistor.
HardwareSerial ServoSerial(1);
SCSCL sc;

// ─── Motion constants ────────────────────────────────────────────────────────
const float RAMP_ALPHA  = 0.25;  // smoothing factor (0=sluggish, 1=instant)
const int   DRIVE_SCALE = 700;   // max servo speed at full intent deflection

// Camera tilt in SCS position steps (0-1023 maps to 0-300°)
// 140° ≈ 478, 175° ≈ 597, 180° ≈ 614
const int TILT_MIN   = 478;
const int TILT_MAX   = 614;
const int TILT_START = 597;
const int TILT_STEP  = 4;

long ttime = 0;

extern AsyncWebSocket wsCommand;
extern SkuttleIntent currentIntent;  // set by WS handler in Skuttleshell.ino

Skuttlemove::Skuttlemove()
    : rCurrent(0), lCurrent(0), tpos(TILT_START) {}

void Skuttlemove::setup() {
    ServoSerial.begin(1000000, SERIAL_8N1, SERVO_UART_RX, SERVO_UART_TX);
    sc.pSerial = &ServoSerial;

    // Set drive servos to wheel mode (register 33 = Operation Mode, value 1)
    sc.writeByte(SERVO_RIGHT_ID, 33, 1);
    delay(10);
    sc.writeByte(SERVO_LEFT_ID, 33, 1);
    delay(10);

    sc.WriteSpe(SERVO_RIGHT_ID, 0, 0);
    sc.WriteSpe(SERVO_LEFT_ID,  0, 0);

    sc.WritePos(SERVO_TILT_ID, TILT_START, 500, 200);
    delay(600);

    Serial.println("Servo bus initialized");

    xTaskCreatePinnedToCore(
        moveTask, "MoveTask", 2048, this, 1, NULL, 0
    );
    Serial.println("Move Task Set on Core 0");
}

void Skuttlemove::moveTask(void *pvParameters) {
    Skuttlemove *m = static_cast<Skuttlemove*>(pvParameters);
    for (;;) {
        m->executeMovement();
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void Skuttlemove::executeMovement() {
    action(currentIntent);
}

void Skuttlemove::action(const SkuttleIntent& intent) {
    if (intent.emergencyStop) {
        setWheels(0, 0);
        return;
    }

    // Differential drive from normalised intent values.
    // intent.moveY: +1 = forward,  intent.turnZ: +1 = CCW (left turn)
    // lSpeed = moveY - turnZ  (left wheel slows on a left/CCW turn)
    // rSpeed = moveY + turnZ  (right wheel speeds up on a left/CCW turn)
    // NOTE: if the robot turns the wrong way, negate turnZ in renderer.js.
    float lTarget = (intent.moveY - intent.turnZ) * DRIVE_SCALE * intent.speed;
    float rTarget = (intent.moveY + intent.turnZ) * DRIVE_SCALE * intent.speed;
    setWheels(lTarget, rTarget);

    if      (intent.tiltY >  0.5f) setTilt( 1);
    else if (intent.tiltY < -0.5f) setTilt(-1);
}

void Skuttlemove::setWheels(float leftSpeed, float rightSpeed) {
    lCurrent += (leftSpeed  - lCurrent) * RAMP_ALPHA;
    rCurrent += (rightSpeed - rCurrent) * RAMP_ALPHA;

    int lOut = (abs(lCurrent) < 20) ? 0 : (int)lCurrent;
    int rOut = (abs(rCurrent) < 20) ? 0 : (int)rCurrent;

    sc.WriteSpe(SERVO_LEFT_ID,  lOut, 0);
    sc.WriteSpe(SERVO_RIGHT_ID, rOut, 0);
}

void Skuttlemove::setTilt(int direction) {
    if (millis() - ttime < 50) return;
    tpos = constrain(tpos + direction * TILT_STEP, TILT_MIN, TILT_MAX);
    sc.WritePos(SERVO_TILT_ID, tpos, 100, 200);
    wsCommand.textAll("cam pos: " + String(tpos));
    ttime = millis();
}
