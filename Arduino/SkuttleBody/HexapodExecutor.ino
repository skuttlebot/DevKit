// HexapodExecutor.ino — Hexapod gait engine
// Translates SkuttleIntent into 18-servo tripod gait.
// Requires SCServo library from Feetech (same as Skuttleshell).

#include "HexapodExecutor.h"
#include "config.h"
#include <SCServo.h>

HardwareSerial LegSerial(1);
SCSCL legs;

// ─── Servo IDs ────────────────────────────────────────────────────────────────
// servoIds[leg][joint]: leg 0-5 (FR,FL,MR,ML,RR,RL), joint 0=coxa,1=femur,2=tibia
static const int SERVO_ID_TABLE[6][3] = {
    { LEG1_COXA_ID, LEG1_FEMUR_ID, LEG1_TIBIA_ID },   // leg 1 – front right
    { LEG2_COXA_ID, LEG2_FEMUR_ID, LEG2_TIBIA_ID },   // leg 2 – front left
    { LEG3_COXA_ID, LEG3_FEMUR_ID, LEG3_TIBIA_ID },   // leg 3 – mid right
    { LEG4_COXA_ID, LEG4_FEMUR_ID, LEG4_TIBIA_ID },   // leg 4 – mid left
    { LEG5_COXA_ID, LEG5_FEMUR_ID, LEG5_TIBIA_ID },   // leg 5 – rear right
    { LEG6_COXA_ID, LEG6_FEMUR_ID, LEG6_TIBIA_ID },   // leg 6 – rear left
};

// Tripod groups: legs that move together in each phase
//   Group A (even-indexed in SERVO_ID_TABLE): legs 1,3,5 (FR, MR, RL)
//   Group B (odd-indexed):                   legs 2,4,6 (FL, ML, RR)
static const int GROUP_A[] = { 0, 2, 4 };   // indices into SERVO_ID_TABLE
static const int GROUP_B[] = { 1, 3, 5 };

// ─── Gait positions (SCS steps, 0-1023) ──────────────────────────────────────
// SCS maps 0-1023 to 0-300°. 512 ≈ 150° (mechanical centre).
//
// Coxa swing range:  ±30° from centre → ≈ 409 to 614
// Femur lift height: 370 (raised), 400 (neutral/planted)
// Tibia angle:       620 (planted), 560 (lifted)
static const int COXA_CENTRE  = 512;
static const int COXA_SWING   = 50;    // steps each side of centre per step
static const int FEMUR_PLANTED= 400;
static const int FEMUR_LIFTED = 340;
static const int TIBIA_PLANTED= 620;
static const int TIBIA_LIFTED = 560;
static const int GAIT_TIME_MS = 200;   // time (ms) for each servo motion

// ─────────────────────────────────────────────────────────────────────────────

HexapodExecutor::HexapodExecutor() : gaitPhase(0), lastStepTime(0) {
    for (int l = 0; l < 6; l++)
        for (int j = 0; j < 3; j++)
            servoIds[l][j] = SERVO_ID_TABLE[l][j];
}

void HexapodExecutor::setup() {
    LegSerial.begin(1000000, SERIAL_8N1, SERVO_UART_RX, SERVO_UART_TX);
    legs.pSerial = &LegSerial;
    Serial.println("Leg serial bus initialised");
    homeAll();
    Serial.println("Hexapod homed");
}

void HexapodExecutor::executeIntent(const SkuttleIntent& intent) {
    if (intent.emergencyStop) {
        stop();
        return;
    }

    float threshold = 0.1f;

    if (abs(intent.moveY) > threshold) {
        if (intent.moveY > 0) forward(intent.speed);
        else                  backward(intent.speed);

    } else if (abs(intent.turnZ) > threshold) {
        if (intent.turnZ > 0) pivotCCW(intent.speed * abs(intent.turnZ));
        else                  pivotCW (intent.speed * abs(intent.turnZ));

    } else {
        stop();
    }
}

// ─── Tripod gait ─────────────────────────────────────────────────────────────
// Phase 0: Group A lifts and swings forward, Group B pushes backward (propulsion).
// Phase 1: Groups swap roles.
void HexapodExecutor::forward(float speed) {
    long stepPeriod = (long)(GAIT_TIME_MS / max(speed, 0.1f));
    if (millis() - lastStepTime < stepPeriod) return;
    lastStepTime = millis();

    const int* swing  = (gaitPhase == 0) ? GROUP_A : GROUP_B;
    const int* push   = (gaitPhase == 0) ? GROUP_B : GROUP_A;
    int swingTarget = COXA_CENTRE + COXA_SWING;
    int pushTarget  = COXA_CENTRE - COXA_SWING;

    // Lift swing group, plant push group
    for (int i = 0; i < 3; i++) {
        setLeg(swing[i], swingTarget, FEMUR_LIFTED, TIBIA_LIFTED, GAIT_TIME_MS);
        setLeg(push[i],  pushTarget,  FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
    }
    gaitPhase ^= 1;
}

void HexapodExecutor::backward(float speed) {
    long stepPeriod = (long)(GAIT_TIME_MS / max(speed, 0.1f));
    if (millis() - lastStepTime < stepPeriod) return;
    lastStepTime = millis();

    const int* swing  = (gaitPhase == 0) ? GROUP_A : GROUP_B;
    const int* push   = (gaitPhase == 0) ? GROUP_B : GROUP_A;
    int swingTarget = COXA_CENTRE - COXA_SWING;
    int pushTarget  = COXA_CENTRE + COXA_SWING;

    for (int i = 0; i < 3; i++) {
        setLeg(swing[i], swingTarget, FEMUR_LIFTED, TIBIA_LIFTED, GAIT_TIME_MS);
        setLeg(push[i],  pushTarget,  FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
    }
    gaitPhase ^= 1;
}

// Pivot: all legs on one side swing one direction, other side the opposite.
void HexapodExecutor::pivotCW(float rate) {
    long stepPeriod = (long)(GAIT_TIME_MS / max(rate, 0.1f));
    if (millis() - lastStepTime < stepPeriod) return;
    lastStepTime = millis();

    // Right-side legs (0,2,4) swing CW, left-side (1,3,5) swing CCW
    const int right[] = { 0, 2, 4 };
    const int left[]  = { 1, 3, 5 };
    for (int i = 0; i < 3; i++) {
        setLeg(right[i], COXA_CENTRE + COXA_SWING, FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
        setLeg(left[i],  COXA_CENTRE - COXA_SWING, FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
    }
}

void HexapodExecutor::pivotCCW(float rate) {
    long stepPeriod = (long)(GAIT_TIME_MS / max(rate, 0.1f));
    if (millis() - lastStepTime < stepPeriod) return;
    lastStepTime = millis();

    const int right[] = { 0, 2, 4 };
    const int left[]  = { 1, 3, 5 };
    for (int i = 0; i < 3; i++) {
        setLeg(right[i], COXA_CENTRE - COXA_SWING, FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
        setLeg(left[i],  COXA_CENTRE + COXA_SWING, FEMUR_PLANTED, TIBIA_PLANTED, GAIT_TIME_MS);
    }
}

void HexapodExecutor::stop() {
    // Send zero-speed to all wheels — not applicable for position servos.
    // For hexapod, "stop" means hold current position (do nothing).
}

void HexapodExecutor::homeAll() {
    for (int l = 0; l < 6; l++) {
        setLeg(l, COXA_CENTRE, FEMUR_PLANTED, TIBIA_PLANTED, 500);
    }
    delay(600);
}

// ─── Low-level helpers ────────────────────────────────────────────────────────
void HexapodExecutor::setLeg(int legIndex, int coxaPos, int femurPos, int tibiaPos, int time_ms) {
    legs.WritePos(servoIds[legIndex][0], coxaPos,  time_ms, 50);
    legs.WritePos(servoIds[legIndex][1], femurPos, time_ms, 50);
    legs.WritePos(servoIds[legIndex][2], tibiaPos, time_ms, 50);
}
