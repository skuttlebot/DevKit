#pragma once
#include <Arduino.h>
#include <SkuttleCore.h>

// ─── HexapodExecutor ─────────────────────────────────────────────────────────
// Translates a SkuttleIntent into physical leg movements on a 6-DOF hexapod
// with 3 SCS0009 serial bus servos per leg (18 servos total).
//
// Gait overview:
//   - Tripod gait: legs {1,3,5} and {2,4,6} alternate lift/swing/plant cycles.
//   - Forward/backward: controlled by intent.moveY
//   - Yaw/pivot: controlled by intent.turnZ
//   - Strafe: controlled by intent.moveX (future — needs coxa range)
//   - Speed: intent.speed scales gait timing
//   - Emergency stop: all joints to home position and hold
// ─────────────────────────────────────────────────────────────────────────────

class HexapodExecutor {
public:
    HexapodExecutor();
    void setup();
    void executeIntent(const SkuttleIntent& intent);

private:
    // Gait helpers
    void forward(float speed);
    void backward(float speed);
    void pivotCW(float rate);
    void pivotCCW(float rate);
    void stop();
    void homeAll();

    // Low-level leg control
    void setLeg(int legIndex, int coxaPos, int femurPos, int tibiaPos, int time_ms);
    void setLegSpeed(int legIndex, int speed);

    // Servo ID lookup: servoIds[leg][joint] (leg 0-5, joint 0=coxa 1=femur 2=tibia)
    int servoIds[6][3];

    // Gait state
    int  gaitPhase;         // 0 = group A up, 1 = group B up
    long lastStepTime;

    // Home/neutral positions (SCS steps, 0-1023)
    static const int HOME_COXA  = 512;   // 150° — straight out
    static const int HOME_FEMUR = 400;   // slightly raised
    static const int HOME_TIBIA = 600;   // foot planted
};
