export const CURRICULUM_LENSES = [
  { id: 'in', name: 'India', description: 'NEP-FLN / NIPUN', icon: '🇮🇳' },
  { id: 'uk', name: 'UK', description: 'National Curriculum KS1', icon: '🇬🇧' },
  { id: 'us', name: 'US', description: 'CCSS Foundational', icon: '🇺🇸' },
  { id: 'ib', name: 'IB', description: 'IB PYP Framework', icon: '🌐' }
];

export const READ_ALOUD_IMAGES = [
  // Age 3-4
  { id: 1, word: "Cat", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Cat.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /k/'] },
  { id: 2, word: "Dog", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Dog.webp?crop=1xw:0.99967xh;center,top&resize=1200:*", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /d/'] },
  { id: 3, word: "Ball", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/ball.webp?w=360", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /b/'] },
  // { id: 4, word: "Tree", imageUrl: "https://drawingsof.com/wp-content/uploads/2024/02/Tree3-1200x1200.png.webp", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Nature Focus', 'Easy Words'] },
  { id: 101, word: "Fish", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Fish.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /f/'] },
  { id: 102, word: "Car", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Car.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /k/'] },
  // { id: 103, word: "Sun", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Sun.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /s/'] },
  { id: 104, word: "Apple", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Apple.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /a/', 'Syllables: ap-ple (2)'] },
  { id: 105, word: "Banana", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Banana.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /b/', 'Syllables: ba-na-na (3)'] },
  { id: 106, word: "Lion", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Lion.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /l/', 'Syllables: li-on (2)'] },
  { id: 107, word: "Flower", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Flower.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /f/', 'Syllables: flow-er (2)'] },
  { id: 108, word: "House", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/House.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /h/'] },
  { id: 109, word: "Rainbow", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Rainbow.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'easy', ageGroup: '3-4', badges: ['Age 3-4', 'Oral Language', 'Initial Sound: /r/', 'Syllables: rain-bow (2)'] },

  // Age 5-6
  { id: 7, word: "Elephant", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Elephant.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /e/', 'Syllables: el-e-phant (3)'] },
  { id: 5, word: "Butterfly", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Butterfly.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /b/', 'Syllables: but-ter-fly (3)'] },
  { id: 8, word: "Bicycle", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Bicycle.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /b/', 'Syllables: bi-cy-cle (3)'] },
  { id: 6, word: "Rainbow", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Rainbow.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /r/', 'Syllables: rain-bow (2)'] },
  { id: 201, word: "Kangaroo", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Kangaroo.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /k/', 'Syllables: kan-ga-roo (3)'] },
  { id: 202, word: "Rocket", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Rocket.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /r/', 'Syllables: rock-et (2)'] },
  { id: 203, word: "Mountain", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Mountain.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /m/', 'Syllables: moun-tain (2)'] },
  // { id: 204, word: "Garden", imageUrl: "https://images.pexels.com/photos/158028/pexels-photo-158028.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /g/', 'Syllables: gar-den (2)'] },
  { id: 205, word: "Pirate", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Pirate.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /p/', 'Syllables: pi-rate (2)'] },
  { id: 206, word: "Volcano", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Volcano.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /v/', 'Syllables: vol-ca-no (3)'] },
  { id: 207, word: "Hospital", imageUrl: "https://pub-ffac5160d3fb4bb7a13677a2b6729484.r2.dev/read-aloud-images/read-aloud-image-modes/Hospital.webp?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /h/', 'Syllables: hos-pi-tal (3)'] },
  // { id: 208, word: "Microphone", imageUrl: "https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'medium', ageGroup: '5-6', badges: ['Age 5-6', 'Concept Talk', 'Initial Sound: /m/', 'Syllables: mi-cro-phone (3)'] },

  // Age 7-8
  { id: 9, word: "Telescope", imageUrl: "https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'hard', ageGroup: '7-8', badges: ['Age 7+', 'Scientific Terminology', 'Academic Vocabulary'] },
  { id: 10, word: "Dinosaur", imageUrl: "https://images.pexels.com/photos/3680219/pexels-photo-3680219.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'hard', ageGroup: '7-8', badges: ['Age 7+', 'History Segment', 'Discovery'] },

  // Age 9-12
  { id: 11, word: "Microscope", imageUrl: "https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'hard', ageGroup: '9-12', badges: ['Age 9+', 'Advanced Science', 'STEM Vocabulary'] },
  { id: 12, word: "Architecture", imageUrl: "https://images.pexels.com/photos/161758/governor-s-mansion-montgomery-alabama-grand-staircase-161758.jpeg?auto=compress&cs=tinysrgb&w=400", difficulty: 'hard', ageGroup: '9-12', badges: ['Age 9+', 'Cultural Appreciation', 'Complex Literacy'] },
];

export const READ_ALOUD_WORDS = [
  // Age 3-4 (easy)
  // { id: 301, text: "the", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Article'] },
  // { id: 302, text: "a", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Article'] },
  // { id: 303, text: "I", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Pronoun'] },
  // { id: 304, text: "my", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Possessive'] },
  // { id: 313, text: "you", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Pronoun'] },
  // { id: 314, text: "is", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'High-Frequency', 'Verb (be)'] },
  { id: 315, text: "cat", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },
  { id: 316, text: "dog", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },
  // { id: 317, text: "sun", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },
  { id: 318, text: "bed", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },
  { id: 319, text: "pin", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },
  { id: 320, text: "top", difficulty: 'easy', ageGroup: '3-4', expectedDuration: 2, badges: ['Age 3-4', 'Decodable', 'Phonics: CVC', 'Noun'] },

  // Age 5-6 (medium)
  { id: 321, text: "cake", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: CVCe', 'Noun'] },
  { id: 322, text: "train", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Vowel Team (ai)', 'Noun'] },
  // { id: 323, text: "ship", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Digraph (sh)', 'Noun'] },
  // { id: 324, text: "chair", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: R-Controlled', 'Noun'] },
  { id: 325, text: "night", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: igh pattern', 'Time word'] },
  // { id: 326, text: "bear", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Vowel Team (ea)', 'Noun'] },
  // { id: 327, text: "coin", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Diphthong (oi)', 'Noun'] },
  { id: 328, text: "shout", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Diphthong (ou)', 'Verb'] },
  { id: 329, text: "star", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: R-Controlled (ar)', 'Noun'] },
  { id: 330, text: "spoon", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 3, badges: ['Age 5-6', 'Decodable', 'Phonics: Vowel Team (oo)', 'Noun'] },
  // { id: 331, text: "her", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 2, badges: ['Age 5-6', 'High-Frequency', 'Pronoun', 'Phonics: /er/'] },
  { id: 332, text: "play", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 2, badges: ['Age 5-6', 'Decodable', 'Phonics: Vowel Team (ay)', 'Verb'] },
  { id: 333, text: "beautiful", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'High-Utility', 'Adjective', 'Syllables: beau-ti-ful (3)'] },
  { id: 334, text: "different", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'High-Utility', 'Adjective', 'Syllables: dif-fer-ent (3)'] },
  { id: 335, text: "together", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'High-Utility', 'Adverb', 'Syllables: to-geth-er (3)'] },

  // Age 7-8 (hard)
  { id: 309, text: "Telescope", difficulty: 'hard', ageGroup: '7-8', expectedDuration: 4, badges: ['Age 7+', 'Science', 'Academic'] },
  { id: 310, text: "Dinosaur", difficulty: 'hard', ageGroup: '7-8', expectedDuration: 4, badges: ['Age 7+', 'History', 'STEM'] },

  // Age 9-12 (hard)
  { id: 311, text: "Microscope", difficulty: 'hard', ageGroup: '9-12', expectedDuration: 4, badges: ['Age 9+', 'Laboratory', 'STEM'] },
  { id: 312, text: "Architecture", difficulty: 'hard', ageGroup: '9-12', expectedDuration: 4, badges: ['Age 9+', 'Structure', 'Humanities'] },
];

export const READ_ALOUD_SENTENCES = [
  // Age 5-6
  // { id: 401, text: "I see a red ball.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'Grammar: Simple', 'Punctuation: Capital + period'] },
  { id: 402, text: "The cat is on the bed.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Preposition (on)', 'Punctuation: Capital + period'] },
  { id: 403, text: "We play in the park.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Preposition (in)', 'Punctuation: Capital + period'] },
  { id: 404, text: "She has two books.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Plural -s', 'Punctuation: Capital + period'] },
  // { id: 405, text: "He can hop and run.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Conjunction (and)', 'Punctuation: Capital + period'] },
  { id: 406, text: "My dog runs fast.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Possessive (my)', 'Punctuation: Capital + period'] },
  // { id: 407, text: "Is the sun up?", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'Grammar: Question', 'Punctuation: Question mark'] },
  // { id: 408, text: "The fish swims in water.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Present tense', 'Punctuation: Capital + period'] },
  { id: 409, text: "I like cake and fruit.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Conjunction (and)', 'Punctuation: Capital + period'] },
  { id: 410, text: "We went to the shop.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 5, badges: ['Age 5-6', 'Grammar: Past tense (went)', 'Punctuation: Capital + period'] },
  { id: 411, text: "Put the toy under the chair.", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 6, badges: ['Age 5-6', 'Grammar: Preposition (under)', 'Punctuation: Capital + period'] },
  { id: 412, text: "Can you help me?", difficulty: 'medium', ageGroup: '5-6', expectedDuration: 4, badges: ['Age 5-6', 'Grammar: Question', 'Punctuation: Question mark'] },

  // Age 7-8
  { id: 19, text: "The astronaut explored the mysterious planet with advanced equipment.", difficulty: 'hard', ageGroup: '7-8', expectedDuration: 7, badges: ['Age 7+', 'Complex Objects', 'Vocabulary Expansion'] },
  { id: 20, text: "Scientists discovered fascinating creatures in the deep ocean.", difficulty: 'hard', ageGroup: '7-8', expectedDuration: 6, badges: ['Age 7+', 'Academic Verbs', 'Contextual'] },

  // Age 9-12
  { id: 21, text: "The archaeological expedition uncovered ancient artifacts that revealed important historical information.", difficulty: 'hard', ageGroup: '9-12', expectedDuration: 8, badges: ['Age 9+', 'Relative Clauses', 'Historical Context'] },
  { id: 22, text: "Environmental conservation requires collaborative efforts from communities worldwide.", difficulty: 'hard', ageGroup: '9-12', expectedDuration: 7, badges: ['Age 9+', 'Abstract Concepts', 'Global Awareness'] },
];

export const READ_ALOUD_STORIES = [
  // Age 5-6
  {
    id: 501,
    title: "The Lost Balloon",
    sentences: [
      "Mia has a red balloon.",
      "The string slips from her hand and the balloon flies up.",
      "Ben brings a chair, and they reach the string together.",
      "Mia says, “Thank you!” and they play again."
    ],
    difficulty: 'medium',
    ageGroup: '5-6',
    expectedWPM: 50,
    badges: ['Theme: Friendship', 'Skill: WH questions', 'Length: 4 sentences'],
    teacherPrompt: "Who helped Mia?"
  },
  {
    id: 502,
    title: "A Day at the Park",
    sentences: [
      "We go to the park after school.",
      "I swing high, and my sister slides down.",
      "We eat a snack and drink water.",
      "Then we walk home and wave goodbye."
    ],
    difficulty: 'medium',
    ageGroup: '5-6',
    expectedWPM: 50,
    badges: ['Theme: Outdoors', 'Skill: Sequencing', 'Length: 4 sentences'],
    teacherPrompt: "What did they do first?"
  },
  {
    id: 503,
    title: "Rainbow After Rain",
    sentences: [
      "Dark clouds cover the sky and rain falls.",
      "After the rain, the sun comes out.",
      "A rainbow appears with many colors.",
      "We smile and count the colors we see."
    ],
    difficulty: 'medium',
    ageGroup: '5-6',
    expectedWPM: 50,
    badges: ['Theme: Nature', 'Skill: Cause & effect', 'Length: 4 sentences'],
    teacherPrompt: "What happened after the rain?"
  },
  {
    id: 504,
    title: "The Garden Surprise",
    sentences: [
      "We water the garden every day.",
      "One morning, a small plant looks different.",
      "By afternoon, a yellow flower opens.",
      "We guess what color the next flower will be."
    ],
    difficulty: 'medium',
    ageGroup: '5-6',
    expectedWPM: 50,
    badges: ['Theme: Nature', 'Skill: Predicting', 'Length: 4 sentences'],
    teacherPrompt: "What did they see in the afternoon?"
  },
  {
    id: 505,
    title: "Together We Build",
    sentences: [
      "Sam and Asha build a tall block tower.",
      "The tower falls when it gets too high.",
      "They make a wide base and try again.",
      "This time the tower stays up, and they cheer."
    ],
    difficulty: 'medium',
    ageGroup: '5-6',
    expectedWPM: 50,
    badges: ['Theme: Teamwork', 'Skill: Problem–solution', 'Length: 4 sentences'],
    teacherPrompt: "What did they change to fix the problem?"
  },

  // Age 7-8
  {
    id: 25,
    title: "The Space Explorer",
    sentences: [
      "Captain Sarah prepared her spacecraft for the important mission.",
      "She had trained for years to explore the distant planet.",
      "The journey would take several months through the galaxy.",
      "Her team was excited to discover new forms of life."
    ],
    difficulty: 'hard',
    ageGroup: '7-8',
    expectedWPM: 70,
    badges: ['Age 7+', 'STEM Narrative', 'Logical Flow']
  },

  // Age 9-12
  {
    id: 26,
    title: "The Ancient Discovery",
    sentences: [
      "Dr. Martinez carefully excavated the archaeological site.",
      "The ancient civilization had left behind remarkable artifacts.",
      "Each discovery provided valuable insights into their culture.",
      "The research would contribute significantly to historical understanding.",
      "Future generations would benefit from this important work."
    ],
    difficulty: 'hard',
    ageGroup: '9-12',
    expectedWPM: 90,
    badges: ['Age 9+', 'Expository', 'Complex Vocabulary']
  }
];

export const AGE_GROUPS = [
  { value: '3-4', label: '3-4 years', color: 'from-pink-400 to-pink-500' },
  { value: '5-6', label: '5-6 years', color: 'from-blue-400 to-blue-500' },
  // { value: '7-8', label: '7-8 years', color: 'from-purple-400 to-purple-500' },
  // { value: '9-12', label: '9-12 years', color: 'from-emerald-400 to-emerald-500' }
];

export const READING_MODES = [
  {
    id: 'word',
    title: 'Image Mode',
    description: 'Say the word you see in the picture',
    icon: '🖼️',
    color: 'from-orange-400 to-orange-500'
  },
  {
    id: 'words',
    title: 'Word Mode',
    description: 'Say the word you see in front of you',
    icon: '🔠',
    color: 'from-teal-400 to-teal-500'
  },
  {
    id: 'sentence',
    title: 'Sentence Mode',
    description: 'Read the sentence aloud clearly',
    icon: '📝',
    color: 'from-blue-400 to-blue-500'
  },
  {
    id: 'story',
    title: 'Story Mode',
    description: 'Read the complete story fluently',
    icon: '📚',
    color: 'from-purple-400 to-purple-500'
  }
];
