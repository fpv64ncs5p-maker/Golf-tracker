// Course data types and constants
export interface TeeData {
  par: number;
  rating: number | null;
  slope: number | null;
}

export interface Hole {
  hole: number;
  par: number;
  distance: number;
  distanceByTee?: Record<string, number>;
}

export interface Course {
  id: string;
  country: string;
  club?: string;
  name: string;
  tees: Record<string, TeeData>;
  holes: Hole[];
}

export const GENDERSTEYN_GELE_LUS: Course = {
  id: 'gendersteyn-gele-lus',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Gendersteyn — Gele lus',
  tees: {
    White:  { par: 36, rating: null, slope: null },
    Yellow: { par: 36, rating: 36.1, slope: 132 },
    Blue:   { par: 36, rating: null, slope: null },
    Red:    { par: 36, rating: null, slope: null },
  },
  holes: [
    { hole: 1, par: 5, distance: 483, distanceByTee: { White: 495, Yellow: 483, Blue: 455, Red: 448 } },
    { hole: 2, par: 4, distance: 299, distanceByTee: { White: 317, Yellow: 299, Blue: 258, Red: 246 } },
    { hole: 3, par: 5, distance: 454, distanceByTee: { White: 466, Yellow: 454, Blue: 392, Red: 387 } },
    { hole: 4, par: 4, distance: 389, distanceByTee: { White: 399, Yellow: 389, Blue: 349, Red: 325 } },
    { hole: 5, par: 4, distance: 347, distanceByTee: { White: 356, Yellow: 347, Blue: 301, Red: 289 } },
    { hole: 6, par: 3, distance: 134, distanceByTee: { White: 138, Yellow: 134, Blue: 126, Red: 115 } },
    { hole: 7, par: 4, distance: 348, distanceByTee: { White: 362, Yellow: 348, Blue: 304, Red: 288 } },
    { hole: 8, par: 3, distance: 160, distanceByTee: { White: 167, Yellow: 160, Blue: 146, Red: 136 } },
    { hole: 9, par: 4, distance: 327, distanceByTee: { White: 334, Yellow: 327, Blue: 284, Red: 275 } },
  ],
};

export const GENDERSTEYN_RODE_LUS: Course = {
  id: 'gendersteyn-rode-lus',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Gendersteyn — Rode lus',
  tees: {
    White:  { par: 35, rating: null, slope: null },
    Yellow: { par: 35, rating: null, slope: null },
    Blue:   { par: 35, rating: null, slope: null },
    Red:    { par: 35, rating: 35.4, slope: 129 },
  },
  holes: [
    { hole: 1, par: 4, distance: 326, distanceByTee: { White: 331, Yellow: 326, Blue: 295, Red: 288 } },
    { hole: 2, par: 4, distance: 377, distanceByTee: { White: 382, Yellow: 377, Blue: 331, Red: 329 } },
    { hole: 3, par: 4, distance: 339, distanceByTee: { White: 350, Yellow: 339, Blue: 336, Red: 278 } },
    { hole: 4, par: 3, distance: 146, distanceByTee: { White: 154, Yellow: 146, Blue: 144, Red: 130 } },
    { hole: 5, par: 4, distance: 338, distanceByTee: { White: 342, Yellow: 338, Blue: 288, Red: 285 } },
    { hole: 6, par: 4, distance: 346, distanceByTee: { White: 357, Yellow: 346, Blue: 343, Red: 297 } },
    { hole: 7, par: 3, distance: 131, distanceByTee: { White: 131, Yellow: 131, Blue: 128, Red: 116 } },
    { hole: 8, par: 4, distance: 340, distanceByTee: { White: 348, Yellow: 340, Blue: 292, Red: 287 } },
    { hole: 9, par: 5, distance: 455, distanceByTee: { White: 463, Yellow: 455, Blue: 450, Red: 385 } },
  ],
};

export const DE_LOONSCHE_DUYNEN: Course = {
  id: 'de-loonsche-duynen',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'De Loonsche Duynen',
  tees: {
    White:  { par: 72, rating: 72.7, slope: 131 },
    Yellow: { par: 72, rating: 71.2, slope: 127 },
    Blue:   { par: 72, rating: 68.2, slope: 118 },
    Red:    { par: 72, rating: 66.6, slope: 111 },
    Orange: { par: 72, rating: 65.2, slope: 107 },
  },
  holes: [
    { hole: 1,  par: 4, distance: 373, distanceByTee: { White: 408, Yellow: 373, Blue: 345, Red: 315, Orange: 294 } },
    { hole: 2,  par: 4, distance: 342, distanceByTee: { White: 375, Yellow: 342, Blue: 342, Red: 312, Orange: 280 } },
    { hole: 3,  par: 5, distance: 468, distanceByTee: { White: 489, Yellow: 468, Blue: 399, Red: 392, Orange: 392 } },
    { hole: 4,  par: 4, distance: 376, distanceByTee: { White: 390, Yellow: 376, Blue: 325, Red: 320, Orange: 281 } },
    { hole: 5,  par: 4, distance: 278, distanceByTee: { White: 330, Yellow: 278, Blue: 261, Red: 241, Orange: 241 } },
    { hole: 6,  par: 3, distance: 161, distanceByTee: { White: 181, Yellow: 161, Blue: 150, Red: 145, Orange: 140 } },
    { hole: 7,  par: 5, distance: 486, distanceByTee: { White: 505, Yellow: 486, Blue: 428, Red: 415, Orange: 370 } },
    { hole: 8,  par: 3, distance: 145, distanceByTee: { White: 151, Yellow: 145, Blue: 125, Red: 123, Orange: 123 } },
    { hole: 9,  par: 4, distance: 383, distanceByTee: { White: 388, Yellow: 383, Blue: 333, Red: 326, Orange: 289 } },
    { hole: 10, par: 4, distance: 382, distanceByTee: { White: 411, Yellow: 382, Blue: 326, Red: 307, Orange: 275 } },
    { hole: 11, par: 4, distance: 359, distanceByTee: { White: 380, Yellow: 359, Blue: 330, Red: 311, Orange: 290 } },
    { hole: 12, par: 4, distance: 241, distanceByTee: { White: 263, Yellow: 241, Blue: 224, Red: 219, Orange: 219 } },
    { hole: 13, par: 3, distance: 180, distanceByTee: { White: 185, Yellow: 180, Blue: 165, Red: 160, Orange: 160 } },
    { hole: 14, par: 5, distance: 448, distanceByTee: { White: 453, Yellow: 448, Blue: 382, Red: 373, Orange: 373 } },
    { hole: 15, par: 4, distance: 335, distanceByTee: { White: 363, Yellow: 335, Blue: 293, Red: 289, Orange: 289 } },
    { hole: 16, par: 3, distance: 154, distanceByTee: { White: 159, Yellow: 154, Blue: 148, Red: 126, Orange: 125 } },
    { hole: 17, par: 5, distance: 467, distanceByTee: { White: 480, Yellow: 467, Blue: 467, Red: 431, Orange: 382 } },
    { hole: 18, par: 4, distance: 353, distanceByTee: { White: 358, Yellow: 353, Blue: 293, Red: 291, Orange: 291 } },
  ],
};

export const DE_KURENPOLDER: Course = {
  id: 'de-kurenpolder',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'De Kurenpolder',
  tees: {
    Yellow: { par: 68, rating: 34.75, slope: 128 },
    Red:    { par: 68, rating: null,  slope: null },
    Orange: { par: 68, rating: null,  slope: null },
  },
  holes: [
    { hole: 1,  par: 4, distance: 302, distanceByTee: { Yellow: 302, Red: 255, Orange: 230 } },
    { hole: 2,  par: 4, distance: 324, distanceByTee: { Yellow: 324, Red: 286, Orange: 259 } },
    { hole: 3,  par: 5, distance: 478, distanceByTee: { Yellow: 478, Red: 408, Orange: 367 } },
    { hole: 4,  par: 3, distance: 167, distanceByTee: { Yellow: 167, Red: 142, Orange: 128 } },
    { hole: 5,  par: 4, distance: 330, distanceByTee: { Yellow: 330, Red: 272, Orange: 245 } },
    { hole: 6,  par: 4, distance: 357, distanceByTee: { Yellow: 357, Red: 313, Orange: 284 } },
    { hole: 7,  par: 3, distance: 196, distanceByTee: { Yellow: 196, Red: 169, Orange: 152 } },
    { hole: 8,  par: 4, distance: 356, distanceByTee: { Yellow: 356, Red: 327, Orange: 264 } },
    { hole: 9,  par: 3, distance: 136, distanceByTee: { Yellow: 136, Red: 114, Orange: 99  } },
    { hole: 10, par: 4, distance: 302, distanceByTee: { Yellow: 302, Red: 255, Orange: 230 } },
    { hole: 11, par: 4, distance: 324, distanceByTee: { Yellow: 324, Red: 286, Orange: 259 } },
    { hole: 12, par: 5, distance: 478, distanceByTee: { Yellow: 478, Red: 408, Orange: 367 } },
    { hole: 13, par: 3, distance: 167, distanceByTee: { Yellow: 167, Red: 142, Orange: 128 } },
    { hole: 14, par: 4, distance: 330, distanceByTee: { Yellow: 330, Red: 272, Orange: 245 } },
    { hole: 15, par: 4, distance: 357, distanceByTee: { Yellow: 357, Red: 313, Orange: 284 } },
    { hole: 16, par: 3, distance: 196, distanceByTee: { Yellow: 196, Red: 169, Orange: 152 } },
    { hole: 17, par: 4, distance: 356, distanceByTee: { Yellow: 356, Red: 327, Orange: 264 } },
    { hole: 18, par: 3, distance: 136, distanceByTee: { Yellow: 136, Red: 114, Orange: 99  } },
  ],
};

export const DE_BREUNINKHOF: Course = {
  id: 'de-breuninkhof',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'De Breuninkhof',
  tees: {
    Yellow: { par: 72, rating: 36.5, slope: 137 },
    Blue:   { par: 72, rating: null, slope: null },
    Orange: { par: 72, rating: null, slope: null },
  },
  holes: [
    { hole: 1,  par: 4, distance: 346, distanceByTee: { Yellow: 346, Blue: 317, Orange: 256 } },
    { hole: 2,  par: 3, distance: 154, distanceByTee: { Yellow: 154, Blue: 133, Orange: 122 } },
    { hole: 3,  par: 4, distance: 314, distanceByTee: { Yellow: 314, Blue: 303, Orange: 214 } },
    { hole: 4,  par: 3, distance: 105, distanceByTee: { Yellow: 105, Blue: 92,  Orange: 83  } },
    { hole: 5,  par: 5, distance: 441, distanceByTee: { Yellow: 441, Blue: 380, Orange: 342 } },
    { hole: 6,  par: 4, distance: 371, distanceByTee: { Yellow: 371, Blue: 317, Orange: 285 } },
    { hole: 7,  par: 4, distance: 421, distanceByTee: { Yellow: 421, Blue: 357, Orange: 292 } },
    { hole: 8,  par: 5, distance: 446, distanceByTee: { Yellow: 446, Blue: 384, Orange: 336 } },
    { hole: 9,  par: 4, distance: 344, distanceByTee: { Yellow: 344, Blue: 313, Orange: 293 } },
    { hole: 10, par: 4, distance: 320, distanceByTee: { Yellow: 320, Blue: 286, Orange: 256 } },
    { hole: 11, par: 3, distance: 172, distanceByTee: { Yellow: 172, Blue: 154, Orange: 122 } },
    { hole: 12, par: 4, distance: 303, distanceByTee: { Yellow: 303, Blue: 272, Orange: 214 } },
    { hole: 13, par: 3, distance: 121, distanceByTee: { Yellow: 121, Blue: 105, Orange: 83  } },
    { hole: 14, par: 5, distance: 456, distanceByTee: { Yellow: 456, Blue: 394, Orange: 342 } },
    { hole: 15, par: 4, distance: 408, distanceByTee: { Yellow: 408, Blue: 343, Orange: 285 } },
    { hole: 16, par: 4, distance: 383, distanceByTee: { Yellow: 383, Blue: 324, Orange: 292 } },
    { hole: 17, par: 5, distance: 459, distanceByTee: { Yellow: 459, Blue: 404, Orange: 336 } },
    { hole: 18, par: 4, distance: 396, distanceByTee: { Yellow: 396, Blue: 344, Orange: 293 } },
  ],
};

export const DE_BERENDONCK: Course = {
  id: 'de-berendonck',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'De Berendonck',
  tees: {
    White:  { par: 71, rating: 72.0, slope: 132 },
    Yellow: { par: 71, rating: null, slope: null },
    Blue:   { par: 71, rating: null, slope: null },
    Red:    { par: 71, rating: null, slope: null },
    Orange: { par: 71, rating: null, slope: null },
  },
  holes: [
    { hole: 1,  par: 5, distance: 427, distanceByTee: { White: 467, Yellow: 427, Blue: 370, Red: 360, Orange: 305 } },
    { hole: 2,  par: 4, distance: 309, distanceByTee: { White: 348, Yellow: 309, Blue: 299, Red: 289, Orange: 228 } },
    { hole: 3,  par: 4, distance: 324, distanceByTee: { White: 330, Yellow: 324, Blue: 318, Red: 285, Orange: 264 } },
    { hole: 4,  par: 3, distance: 178, distanceByTee: { White: 211, Yellow: 178, Blue: 175, Red: 164, Orange: 142 } },
    { hole: 5,  par: 5, distance: 509, distanceByTee: { White: 545, Yellow: 509, Blue: 417, Red: 407, Orange: 393 } },
    { hole: 6,  par: 3, distance: 152, distanceByTee: { White: 160, Yellow: 152, Blue: 138, Red: 128, Orange: 114 } },
    { hole: 7,  par: 4, distance: 289, distanceByTee: { White: 302, Yellow: 289, Blue: 285, Red: 274, Orange: 260 } },
    { hole: 8,  par: 4, distance: 372, distanceByTee: { White: 382, Yellow: 372, Blue: 355, Red: 310, Orange: 295 } },
    { hole: 9,  par: 4, distance: 358, distanceByTee: { White: 370, Yellow: 358, Blue: 350, Red: 284, Orange: 273 } },
    { hole: 10, par: 4, distance: 380, distanceByTee: { White: 388, Yellow: 380, Blue: 360, Red: 330, Orange: 309 } },
    { hole: 11, par: 3, distance: 132, distanceByTee: { White: 141, Yellow: 132, Blue: 129, Red: 123, Orange: 118 } },
    { hole: 12, par: 5, distance: 435, distanceByTee: { White: 441, Yellow: 435, Blue: 385, Red: 376, Orange: 337 } },
    { hole: 13, par: 4, distance: 266, distanceByTee: { White: 275, Yellow: 266, Blue: 260, Red: 255, Orange: 186 } },
    { hole: 14, par: 4, distance: 353, distanceByTee: { White: 370, Yellow: 353, Blue: 325, Red: 315, Orange: 301 } },
    { hole: 15, par: 3, distance: 141, distanceByTee: { White: 144, Yellow: 141, Blue: 134, Red: 126, Orange: 112 } },
    { hole: 16, par: 4, distance: 372, distanceByTee: { White: 395, Yellow: 372, Blue: 348, Red: 335, Orange: 304 } },
    { hole: 17, par: 3, distance: 146, distanceByTee: { White: 152, Yellow: 146, Blue: 138, Red: 133, Orange: 120 } },
    { hole: 18, par: 5, distance: 451, distanceByTee: { White: 458, Yellow: 451, Blue: 390, Red: 378, Orange: 340 } },
  ],
};

export const PURMER_RODE_LUS: Course = {
  id: 'purmer-rode-lus',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Golfpark De Purmer — Rode lus',
  tees: {
    White:  { par: 35, rating: null, slope: null },
    Yellow: { par: 35, rating: null, slope: null },
    Blue:   { par: 35, rating: null, slope: null },
    Red:    { par: 35, rating: null, slope: null },
  },
  holes: [
    { hole: 1, par: 4, distance: 336, distanceByTee: { White: 336, Yellow: 336, Blue: 309, Red: 309 } },
    { hole: 2, par: 4, distance: 266, distanceByTee: { White: 278, Yellow: 266, Blue: 244, Red: 224 } },
    { hole: 3, par: 4, distance: 300, distanceByTee: { White: 333, Yellow: 300, Blue: 279, Red: 260 } },
    { hole: 4, par: 3, distance: 131, distanceByTee: { White: 139, Yellow: 131, Blue: 121, Red: 109 } },
    { hole: 5, par: 4, distance: 363, distanceByTee: { White: 384, Yellow: 363, Blue: 326, Red: 305 } },
    { hole: 6, par: 3, distance: 154, distanceByTee: { White: 163, Yellow: 154, Blue: 146, Red: 132 } },
    { hole: 7, par: 5, distance: 439, distanceByTee: { White: 458, Yellow: 439, Blue: 374, Red: 362 } },
    { hole: 8, par: 3, distance: 149, distanceByTee: { White: 163, Yellow: 149, Blue: 141, Red: 133 } },
    { hole: 9, par: 5, distance: 436, distanceByTee: { White: 436, Yellow: 436, Blue: 388, Red: 388 } },
  ],
};

export const PURMER_WITTE_LUS: Course = {
  id: 'purmer-witte-lus',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Golfpark De Purmer — Witte lus',
  tees: {
    White:  { par: 36, rating: null, slope: null },
    Yellow: { par: 36, rating: null, slope: null },
    Blue:   { par: 36, rating: null, slope: null },
    Red:    { par: 36, rating: null, slope: null },
  },
  holes: [
    { hole: 1, par: 4, distance: 364, distanceByTee: { White: 372, Yellow: 364, Blue: 343, Red: 335 } },
    { hole: 2, par: 4, distance: 318, distanceByTee: { White: 343, Yellow: 318, Blue: 291, Red: 272 } },
    { hole: 3, par: 5, distance: 494, distanceByTee: { White: 524, Yellow: 494, Blue: 429, Red: 411 } },
    { hole: 4, par: 4, distance: 288, distanceByTee: { White: 308, Yellow: 288, Blue: 268, Red: 244 } },
    { hole: 5, par: 5, distance: 462, distanceByTee: { White: 490, Yellow: 462, Blue: 413, Red: 396 } },
    { hole: 6, par: 4, distance: 368, distanceByTee: { White: 401, Yellow: 368, Blue: 330, Red: 308 } },
    { hole: 7, par: 3, distance: 193, distanceByTee: { White: 220, Yellow: 193, Blue: 181, Red: 164 } },
    { hole: 8, par: 4, distance: 332, distanceByTee: { White: 343, Yellow: 332, Blue: 310, Red: 298 } },
    { hole: 9, par: 3, distance: 180, distanceByTee: { White: 189, Yellow: 180, Blue: 158, Red: 158 } },
  ],
};

export const PURMER_GELE_LUS: Course = {
  id: 'purmer-gele-lus',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Golfpark De Purmer — Gele lus',
  tees: {
    White:  { par: 36, rating: null, slope: null },
    Yellow: { par: 36, rating: null, slope: null },
    Blue:   { par: 36, rating: null, slope: null },
    Red:    { par: 36, rating: null, slope: null },
  },
  holes: [
    { hole: 1, par: 4, distance: 245, distanceByTee: { White: 254, Yellow: 245, Blue: 221, Red: 213 } },
    { hole: 2, par: 5, distance: 440, distanceByTee: { White: 460, Yellow: 440, Blue: 424, Red: 404 } },
    { hole: 3, par: 3, distance: 139, distanceByTee: { White: 147, Yellow: 139, Blue: 113, Red: 113 } },
    { hole: 4, par: 4, distance: 327, distanceByTee: { White: 347, Yellow: 327, Blue: 292, Red: 276 } },
    { hole: 5, par: 4, distance: 251, distanceByTee: { White: 274, Yellow: 251, Blue: 229, Red: 205 } },
    { hole: 6, par: 4, distance: 375, distanceByTee: { White: 394, Yellow: 375, Blue: 362, Red: 348 } },
    { hole: 7, par: 3, distance: 124, distanceByTee: { White: 126, Yellow: 124, Blue: 116, Red: 102 } },
    { hole: 8, par: 4, distance: 327, distanceByTee: { White: 365, Yellow: 327, Blue: 311, Red: 278 } },
    { hole: 9, par: 5, distance: 500, distanceByTee: { White: 530, Yellow: 500, Blue: 451, Red: 451 } },
  ],
};

export const DE_HAVERLEIJ: Course = {
  id: 'de-haverleij',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'De Haverleij',
  tees: {
    White:  { par: 72, rating: 70.7, slope: 131 },
    Yellow: { par: 72, rating: null, slope: null },
    Blue:   { par: 72, rating: null, slope: null },
    Red:    { par: 72, rating: null, slope: null },
    Orange: { par: 72, rating: null, slope: null },
  },
  holes: [
    { hole: 1,  par: 5, distance: 442, distanceByTee: { White: 451, Yellow: 442, Blue: 389, Red: 383, Orange: 383 } },
    { hole: 2,  par: 4, distance: 405, distanceByTee: { White: 416, Yellow: 405, Blue: 366, Red: 359, Orange: 299 } },
    { hole: 3,  par: 5, distance: 429, distanceByTee: { White: 429, Yellow: 429, Blue: 377, Red: 377, Orange: 367 } },
    { hole: 4,  par: 3, distance: 141, distanceByTee: { White: 141, Yellow: 141, Blue: 113, Red: 103, Orange: 94  } },
    { hole: 5,  par: 4, distance: 360, distanceByTee: { White: 368, Yellow: 360, Blue: 308, Red: 299, Orange: 290 } },
    { hole: 6,  par: 4, distance: 326, distanceByTee: { White: 334, Yellow: 326, Blue: 319, Red: 283, Orange: 276 } },
    { hole: 7,  par: 3, distance: 179, distanceByTee: { White: 187, Yellow: 179, Blue: 157, Red: 149, Orange: 143 } },
    { hole: 8,  par: 4, distance: 289, distanceByTee: { White: 289, Yellow: 289, Blue: 279, Red: 250, Orange: 240 } },
    { hole: 9,  par: 4, distance: 349, distanceByTee: { White: 357, Yellow: 349, Blue: 294, Red: 285, Orange: 278 } },
    { hole: 10, par: 4, distance: 307, distanceByTee: { White: 307, Yellow: 307, Blue: 303, Red: 263, Orange: 254 } },
    { hole: 11, par: 5, distance: 445, distanceByTee: { White: 495, Yellow: 445, Blue: 445, Red: 411, Orange: 381 } },
    { hole: 12, par: 4, distance: 325, distanceByTee: { White: 333, Yellow: 325, Blue: 301, Red: 272, Orange: 252 } },
    { hole: 13, par: 4, distance: 268, distanceByTee: { White: 268, Yellow: 268, Blue: 258, Red: 222, Orange: 215 } },
    { hole: 14, par: 3, distance: 162, distanceByTee: { White: 168, Yellow: 162, Blue: 146, Red: 140, Orange: 110 } },
    { hole: 15, par: 4, distance: 309, distanceByTee: { White: 319, Yellow: 309, Blue: 300, Red: 275, Orange: 175 } },
    { hole: 16, par: 4, distance: 358, distanceByTee: { White: 366, Yellow: 358, Blue: 322, Red: 268, Orange: 264 } },
    { hole: 17, par: 3, distance: 111, distanceByTee: { White: 111, Yellow: 111, Blue: 111, Red: 92,  Orange: 92  } },
    { hole: 18, par: 5, distance: 467, distanceByTee: { White: 476, Yellow: 467, Blue: 443, Red: 397, Orange: 377 } },
  ],
};

export const CAMPO_REAL: Course = {
  id: 'campo-real',
  country: 'Portugal',
  name: 'Campo Real',
  tees: {
    Black:  { par: 72, rating: 71.5, slope: 136 },
    White:  { par: 72, rating: 69.8, slope: 132 },
    Yellow: { par: 72, rating: 68.3, slope: 129 },
    Blue:   { par: 72, rating: 66.7, slope: 126 },
    Red:    { par: 72, rating: 65.3, slope: 123 },
    Green:  { par: 72, rating: 61.3, slope: 115 },
    Purple: { par: 72, rating: 59.1, slope: 110 },
  },
  holes: [
    { hole: 1,  par: 5, distance: 460, distanceByTee: { Black: 479, White: 464, Yellow: 460, Blue: 433, Red: 395, Green: 285, Purple: 226 } },
    { hole: 2,  par: 4, distance: 335, distanceByTee: { Black: 374, White: 353, Yellow: 335, Blue: 304, Red: 298, Green: 200, Purple: 173 } },
    { hole: 3,  par: 4, distance: 330, distanceByTee: { Black: 389, White: 347, Yellow: 330, Blue: 307, Red: 302, Green: 182, Purple: 162 } },
    { hole: 4,  par: 3, distance: 140, distanceByTee: { Black: 177, White: 158, Yellow: 140, Blue: 135, Red: 126, Green: 123, Purple: 83  } },
    { hole: 5,  par: 5, distance: 390, distanceByTee: { Black: 434, White: 417, Yellow: 390, Blue: 384, Red: 380, Green: 258, Purple: 238 } },
    { hole: 6,  par: 4, distance: 345, distanceByTee: { Black: 409, White: 364, Yellow: 345, Blue: 311, Red: 306, Green: 213, Purple: 168 } },
    { hole: 7,  par: 4, distance: 307, distanceByTee: { Black: 328, White: 320, Yellow: 307, Blue: 300, Red: 285, Green: 194, Purple: 153 } },
    { hole: 8,  par: 3, distance: 170, distanceByTee: { Black: 213, White: 193, Yellow: 170, Blue: 163, Red: 104, Green: 81,  Purple: 78  } },
    { hole: 9,  par: 4, distance: 230, distanceByTee: { Black: 245, White: 237, Yellow: 230, Blue: 196, Red: 190, Green: 184, Purple: 181 } },
    { hole: 10, par: 4, distance: 294, distanceByTee: { Black: 316, White: 306, Yellow: 294, Blue: 276, Red: 264, Green: 200, Purple: 154 } },
    { hole: 11, par: 4, distance: 247, distanceByTee: { Black: 272, White: 261, Yellow: 247, Blue: 228, Red: 222, Green: 219, Purple: 173 } },
    { hole: 12, par: 4, distance: 279, distanceByTee: { Black: 331, White: 294, Yellow: 279, Blue: 255, Red: 249, Green: 200, Purple: 175 } },
    { hole: 13, par: 3, distance: 157, distanceByTee: { Black: 180, White: 173, Yellow: 157, Blue: 147, Red: 127, Green: 124, Purple: 95  } },
    { hole: 14, par: 4, distance: 308, distanceByTee: { Black: 377, White: 327, Yellow: 308, Blue: 304, Red: 292, Green: 216, Purple: 147 } },
    { hole: 15, par: 4, distance: 301, distanceByTee: { Black: 336, White: 315, Yellow: 301, Blue: 233, Red: 228, Green: 188, Purple: 166 } },
    { hole: 16, par: 3, distance: 130, distanceByTee: { Black: 147, White: 140, Yellow: 130, Blue: 123, Red: 117, Green: 121, Purple: 88  } },
    { hole: 17, par: 5, distance: 440, distanceByTee: { Black: 476, White: 457, Yellow: 440, Blue: 423, Red: 380, Green: 265, Purple: 248 } },
    { hole: 18, par: 5, distance: 410, distanceByTee: { Black: 450, White: 433, Yellow: 410, Blue: 403, Red: 365, Green: 221, Purple: 178 } },
  ],
};

export const KROMME_RIJN: Course = {
  id: 'kromme-rijn',
  country: 'Netherlands',
  name: 'Kromme Rijn',
  tees: {
    White:  { par: 35, rating: null, slope: null },
    Yellow: { par: 35, rating: null, slope: null },
    Blue:   { par: 35, rating: null, slope: null },
    Red:    { par: 35, rating: null, slope: null },
    Orange: { par: 35, rating: null, slope: null },
  },
  holes: [
    { hole: 1, par: 4, distance: 378, distanceByTee: { White: 378, Yellow: 378, Blue: 310, Red: 310, Orange: 180 } },
    { hole: 2, par: 4, distance: 345, distanceByTee: { White: 345, Yellow: 345, Blue: 345, Red: 285, Orange: 170 } },
    { hole: 3, par: 3, distance: 155, distanceByTee: { White: 155, Yellow: 155, Blue: 155, Red: 133, Orange: 80  } },
    { hole: 4, par: 4, distance: 371, distanceByTee: { White: 371, Yellow: 371, Blue: 308, Red: 308, Orange: 185 } },
    { hole: 5, par: 5, distance: 468, distanceByTee: { White: 506, Yellow: 468, Blue: 468, Red: 389, Orange: 230 } },
    { hole: 6, par: 3, distance: 103, distanceByTee: { White: 146, Yellow: 103, Blue: 95,  Red: 80,  Orange: 69  } },
    { hole: 7, par: 4, distance: 388, distanceByTee: { White: 388, Yellow: 388, Blue: 332, Red: 332, Orange: 200 } },
    { hole: 8, par: 3, distance: 128, distanceByTee: { White: 154, Yellow: 128, Blue: 128, Red: 110, Orange: 110 } },
    { hole: 9, par: 5, distance: 484, distanceByTee: { White: 541, Yellow: 484, Blue: 400, Red: 400, Orange: 240 } },
  ],
};

export const SHORTGOLF_UTRECHT: Course = {
  id: 'shortgolf-utrecht',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'ShortGolf Utrecht Par 3',
  tees: {
    Yellow: { par: 27, rating: 23, slope: 65 },
    Red:    { par: 27, rating: 24, slope: 68 },
  },
  holes: [
    { hole: 1, par: 3, distance: 58 },
    { hole: 2, par: 3, distance: 56 },
    { hole: 3, par: 3, distance: 56 },
    { hole: 4, par: 3, distance: 60 },
    { hole: 5, par: 3, distance: 92 },
    { hole: 6, par: 3, distance: 123 },
    { hole: 7, par: 3, distance: 118 },
    { hole: 8, par: 3, distance: 67 },
    { hole: 9, par: 3, distance: 75 },
  ],
};

export const WESTEPARK: Course = {
  id: 'westepark',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Westepark',
  tees: {
    White:  { par: 71, rating: 72.0, slope: 136 },  // Men
    Yellow: { par: 71, rating: 71.1, slope: 136 },  // Men
    Blue:   { par: 71, rating: 72.8, slope: 129 },  // Women
    Red:    { par: 71, rating: 71.7, slope: 126 },  // Women
    Orange: { par: 71, rating: null, slope: null },
  },
  holes: [
    { hole: 1,  par: 4, distance: 339, distanceByTee: { White: 339, Yellow: 339, Red: 282, Blue: 282, Orange: 242 } },
    { hole: 2,  par: 5, distance: 482, distanceByTee: { White: 494, Yellow: 482, Red: 420, Blue: 405, Orange: 335 } },
    { hole: 3,  par: 4, distance: 339, distanceByTee: { White: 358, Yellow: 339, Red: 304, Blue: 283, Orange: 219 } },
    { hole: 4,  par: 3, distance: 177, distanceByTee: { White: 190, Yellow: 177, Red: 157, Blue: 143, Orange: 90  } },
    { hole: 5,  par: 4, distance: 396, distanceByTee: { White: 416, Yellow: 396, Red: 337, Blue: 325, Orange: 264 } },
    { hole: 6,  par: 3, distance: 175, distanceByTee: { White: 193, Yellow: 175, Red: 175, Blue: 158, Orange: 152 } },
    { hole: 7,  par: 5, distance: 483, distanceByTee: { White: 517, Yellow: 483, Red: 433, Blue: 415, Orange: 365 } },
    { hole: 8,  par: 4, distance: 236, distanceByTee: { White: 236, Yellow: 236, Red: 217, Blue: 217, Orange: 137 } },
    { hole: 9,  par: 4, distance: 383, distanceByTee: { White: 383, Yellow: 383, Red: 308, Blue: 308, Orange: 262 } },
    { hole: 10, par: 4, distance: 297, distanceByTee: { White: 297, Yellow: 297, Red: 288, Blue: 288, Orange: 200 } },
    { hole: 11, par: 3, distance: 147, distanceByTee: { White: 147, Yellow: 147, Red: 138, Blue: 138, Orange: 85  } },
    { hole: 12, par: 4, distance: 350, distanceByTee: { White: 350, Yellow: 350, Red: 298, Blue: 298, Orange: 248 } },
    { hole: 13, par: 4, distance: 346, distanceByTee: { White: 354, Yellow: 346, Red: 303, Blue: 283, Orange: 222 } },
    { hole: 14, par: 4, distance: 396, distanceByTee: { White: 413, Yellow: 396, Red: 364, Blue: 348, Orange: 253 } },
    { hole: 15, par: 3, distance: 122, distanceByTee: { White: 122, Yellow: 122, Red: 109, Blue: 109, Orange: 106 } },
    { hole: 16, par: 4, distance: 362, distanceByTee: { White: 362, Yellow: 362, Red: 299, Blue: 299, Orange: 249 } },
    { hole: 17, par: 5, distance: 498, distanceByTee: { White: 514, Yellow: 498, Red: 435, Blue: 415, Orange: 367 } },
    { hole: 18, par: 4, distance: 301, distanceByTee: { White: 301, Yellow: 301, Red: 265, Blue: 265, Orange: 211 } },
  ],
};

export const ALMKREEK: Course = {
  id: 'almkreek',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'Almkreek',
  tees: {
    Yellow: { par: 72, rating: null,  slope: null },
    Red:    { par: 72, rating: null,  slope: null },
    Orange: { par: 72, rating: null,  slope: null },
    White:  { par: 72, rating: 71.5, slope: 128 },
  },
  holes: [
    { hole: 1,  par: 4, distance: 362, distanceByTee: { Yellow: 362, Red: 304, Orange: 258 } },
    { hole: 2,  par: 4, distance: 377, distanceByTee: { Yellow: 377, Red: 314, Orange: 263 } },
    { hole: 3,  par: 4, distance: 370, distanceByTee: { Yellow: 370, Red: 333, Orange: 305 } },
    { hole: 4,  par: 5, distance: 515, distanceByTee: { Yellow: 515, Red: 420, Orange: 362 } },
    { hole: 5,  par: 3, distance: 140, distanceByTee: { Yellow: 140, Red: 128, Orange: 117 } },
    { hole: 6,  par: 4, distance: 347, distanceByTee: { Yellow: 347, Red: 302, Orange: 267 } },
    { hole: 7,  par: 4, distance: 361, distanceByTee: { Yellow: 361, Red: 341, Orange: 324 } },
    { hole: 8,  par: 3, distance: 129, distanceByTee: { Yellow: 129, Red: 114, Orange: 99  } },
    { hole: 9,  par: 5, distance: 485, distanceByTee: { Yellow: 485, Red: 412, Orange: 362 } },
    { hole: 10, par: 4, distance: 303, distanceByTee: { Yellow: 303, Red: 259, Orange: 223 } },
    { hole: 11, par: 5, distance: 480, distanceByTee: { Yellow: 480, Red: 419, Orange: 361 } },
    { hole: 12, par: 4, distance: 292, distanceByTee: { Yellow: 292, Red: 271, Orange: 241 } },
    { hole: 13, par: 3, distance: 128, distanceByTee: { Yellow: 128, Red: 112, Orange: 97  } },
    { hole: 14, par: 4, distance: 361, distanceByTee: { Yellow: 361, Red: 298, Orange: 246 } },
    { hole: 15, par: 3, distance: 173, distanceByTee: { Yellow: 173, Red: 147, Orange: 127 } },
    { hole: 16, par: 5, distance: 422, distanceByTee: { Yellow: 422, Red: 342, Orange: 297 } },
    { hole: 17, par: 4, distance: 273, distanceByTee: { Yellow: 273, Red: 240, Orange: 207 } },
    { hole: 18, par: 4, distance: 363, distanceByTee: { Yellow: 363, Red: 298, Orange: 261 } },
  ],
};

export const SHORTGOLF_UTRECHT_PAR34: Course = {
  id: 'shortgolf-utrecht-par34',
  country: 'Netherlands',
  club: 'Hollandsche Golfclub',
  name: 'ShortGolf Utrecht Par 3/4',
  tees: {
    Yellow: { par: 29, rating: 27, slope: 89 },
    Red:    { par: 29, rating: 28, slope: 89 },
  },
  holes: [
    { hole: 1, par: 4, distance: 232 },
    { hole: 2, par: 3, distance: 97 },
    { hole: 3, par: 3, distance: 58 },
    { hole: 4, par: 3, distance: 45 },
    { hole: 5, par: 4, distance: 245 },
    { hole: 6, par: 3, distance: 93 },
    { hole: 7, par: 3, distance: 60 },
    { hole: 8, par: 3, distance: 50 },
    { hole: 9, par: 3, distance: 181 },
  ],
};

// Export all courses as an array for easy iteration
export const ALL_COURSES: Course[] = [
  GENDERSTEYN_GELE_LUS,
  GENDERSTEYN_RODE_LUS,
  DE_LOONSCHE_DUYNEN,
  DE_KURENPOLDER,
  DE_BREUNINKHOF,
  DE_BERENDONCK,
  PURMER_RODE_LUS,
  PURMER_WITTE_LUS,
  PURMER_GELE_LUS,
  DE_HAVERLEIJ,
  CAMPO_REAL,
  KROMME_RIJN,
  SHORTGOLF_UTRECHT,
  WESTEPARK,
  ALMKREEK,
  SHORTGOLF_UTRECHT_PAR34,
];
