#ifndef CONFIG_H
#define CONFIG_H

// ─── Unit Type ───────────────────────────────────────────────────────────────
#define UNIT_TYPE_BODY

// ─── Feature Flags ────────────────────────────────────────────────────────────
// #define HAS_ESPNOW_RX    // uncomment to receive commands via ESP-NOW from head
                             // when not defined, body connects to PC directly via WiFi

// ─── Hexapod Servo IDs (Feetech SCS0009 serial bus) ──────────────────────────
// Servo ID scheme: leg × 10 + joint (1=coxa, 2=femur, 3=tibia)
// Legs are numbered 1-6 starting front-right, going clockwise.
//
//        Front
//   [1]       [2]
//   [3]       [4]   (looking down)
//   [5]       [6]
//        Rear
//
#define LEG_COUNT       6
#define JOINTS_PER_LEG  3

#define LEG1_COXA_ID   11
#define LEG1_FEMUR_ID  12
#define LEG1_TIBIA_ID  13

#define LEG2_COXA_ID   21
#define LEG2_FEMUR_ID  22
#define LEG2_TIBIA_ID  23

#define LEG3_COXA_ID   31
#define LEG3_FEMUR_ID  32
#define LEG3_TIBIA_ID  33

#define LEG4_COXA_ID   41
#define LEG4_FEMUR_ID  42
#define LEG4_TIBIA_ID  43

#define LEG5_COXA_ID   51
#define LEG5_FEMUR_ID  52
#define LEG5_TIBIA_ID  53

#define LEG6_COXA_ID   61
#define LEG6_FEMUR_ID  62
#define LEG6_TIBIA_ID  63

// ─── Board Pins (ESP32 AI-Thinker or compatible) ──────────────────────────────
// The hexapod body uses the AI-Thinker ESP32-CAM — no camera needed here,
// so the camera GPIOs are free for servo bus and other uses.
#define STATUS_LED      33    // onboard LED
#define SERVO_UART_TX   12    // serial bus servo TX
#define SERVO_UART_RX   13    // serial bus servo RX (via 1kΩ resistor to TX line)

// ─── WiFi Credentials ─────────────────────────────────────────────────────────
// WARNING: do not commit real credentials — use config.h.template as reference
#define WIFI_SSID     "ExLabs1"
#define WIFI_PASSWORD "Wecatchasteroids"

// ─── Device Identity ──────────────────────────────────────────────────────────
#define MODULE  "SkuttleBodyMK1"
#define ID      "SB0001"

// ─── ESP-NOW (optional) ───────────────────────────────────────────────────────
// MAC address of the head unit. Only used when HAS_ESPNOW_RX is defined.
// Find the head's MAC by running: Serial.println(WiFi.macAddress()) in setup().
// uint8_t HEAD_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; // replace with real MAC

#endif
