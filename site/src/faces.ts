const FACES: Record<string, { male: string; female: string }> = {
  artist: { male: '👨‍🎨', female: '👩‍🎨' },
  astronaut: { male: '👨‍🚀', female: '👩‍🚀' },
  chef: { male: '👨‍🍳', female: '👩‍🍳' },
  coder: { male: '👨‍💻', female: '👩‍💻' },
  doctor: { male: '👨‍⚕️', female: '👩‍⚕️' },
  farmer: { male: '👨‍🌾', female: '👩‍🌾' },
  firefighter: { male: '👨‍🚒', female: '👩‍🚒' },
  judge: { male: '👨‍⚖️', female: '👩‍⚖️' },
  mechanic: { male: '👨‍🔧', female: '👩‍🔧' },
  nurse: { male: '👨‍⚕️', female: '👩‍⚕️' },
  pilot: { male: '👨‍✈️', female: '👩‍✈️' },
  scientist: { male: '👨‍🔬', female: '👩‍🔬' },
  singer: { male: '👨‍🎤', female: '👩‍🎤' },
  sleuth: { male: '🕵️‍♂️', female: '🕵️‍♀️' },
  teacher: { male: '👨‍🏫', female: '👩‍🏫' },
};

export function faceFor(profession: string, gender: string): string {
  const entry = FACES[profession];
  if (!entry) return gender === 'female' ? '🙎‍♀️' : '🙎‍♂️';
  return gender === 'female' ? entry.female : entry.male;
}
