// Proper nouns (people, cities, countries) that appear in the course's clips/stories.
// These are excluded from frequency lists, word quizzes and the known-word count,
// since memorising a character's name or a city doesn't teach transferable vocabulary.
// Language/nationality words (Deutsch, Englisch, türkisch…) are regular vocab and stay.
const LIST = [
  // people: first names, character names, surnames used in the course
  'adalbert', 'albert', 'alejandro', 'alex', 'alexander', 'alina', 'alma', 'alva', 'andrea', 'ann', 'anna',
  'annegret', 'anton', 'aslan', 'astrid', 'atkinson', 'adkinsen', 'etkinsen', 'bello', 'ben', 'benjamin',
  'brenner', 'brunner', 'bruno', 'carla', 'chris', 'christian', 'cindik', 'clara', 'dana', 'daniel', 'david',
  'dorothea', 'dürer', 'eisenbarth', 'elke', 'emil', 'emma', 'eric', 'erwin', 'evelyn', 'felicitas', 'flemming',
  'florian', 'frank', 'freddy', 'gloria', 'grube', 'gruber', 'günther', 'hannah', 'hansen', 'harry', 'hendricks',
  'henning', 'hofert', 'inge', 'isabel', 'jan', 'janina', 'jann', 'jonas', 'julia', 'julian', 'jürgen', 'karin',
  'kremmer', 'lara', 'lars', 'lauris', 'lea', 'leonie', 'liam', 'lisa', 'locke', 'lotte', 'luisa', 'lukas',
  'lydia', 'magdalena', 'malene', 'manja', 'marco', 'marek', 'maria', 'mario', 'markus', 'martha', 'martin',
  'marvin', 'mary', 'masius', 'masoud', 'massoud', 'max', 'may', 'meinert', 'merve', 'mia', 'michael', 'michi',
  'mike', 'minka', 'miriam', 'monika', 'nadine', 'nawin', 'nicole', 'nico', 'nicos', 'niklas', 'nina', 'norbert',
  'olli', 'otto', 'patschorke', 'pachorke', 'paul', 'peter', 'pichler', 'ramos', 'raphael', 'ribeiro', 'rittner',
  'sabine', 'sanchez', 'sanders', 'sarah', 'schmidt', 'schneider', 'schubert', 'sebastian', 'selma', 'sheila',
  'simon', 'sina', 'stefan', 'steckel', 'stifter', 'susanne', 'svenja', 'tarek', 'thompson', 'tilo', 'tim', 'tom',
  'victor', 'viktoria', 'wachter', 'walter', 'yanis', 'yara',
  // cities, specific places and streets
  'amsterdam', 'bahnhofstraße', 'barcelona', 'basel', 'berlin', 'bodensee', 'brandenburger', 'dortmund',
  'elmenbüttel', 'frankfurt', 'goetheplatz', 'grafenplatz', 'hamburg', 'heidelberg', 'konstanz', 'krugstraße',
  'kälberstraße', 'köln', 'königshof', 'leipzig', 'münchen', 'paris', 'rom', 'schreinerstraße', 'sevilla',
  'straußberg', 'stuttgart', 'ulm', 'wagnergasse', 'winterberg', 'witzstadt', 'zürich',
  // countries and continents (the place name itself)
  'amerika', 'deutschland', 'eritrea', 'europa', 'frankreich', 'hawaii', 'italien', 'norwegen', 'schweden',
  'schweiz', 'spanien', 'syrien', 'türkei', 'usa',
];
export const PROPER_NOUNS = new Set(LIST);
export const isProperNoun = (normalisedWord) => PROPER_NOUNS.has(normalisedWord);
