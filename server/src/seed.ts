import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { CategoryModel, CourseModel, ExamModel, QuestionModel, RoutineDayModel, SettingModel, UserModel, VocabPageModel } from "./models";
import { ensureExams } from "./services/examService";
import { addDays, dhakaStartOfDay } from "./utils/time";

const BANGLA = ["Alphabet", "Word origin", "Sandhi", "Samas", "Idioms", "Proverbs", "Synonyms", "Antonyms", "One-word", "Punctuation", "Grammar mix"];
const ENGLISH = ["Noun", "Pronoun", "Verb", "Adjective", "Tense", "Adverb", "Preposition", "Articles", "Voice", "Narration", "Vocabulary mix"];
const MATH = ["Percentage", "Ratio", "Average", "Profit and Loss", "Simple interest", "Time and Work", "Speed and Distance", "Number system", "Algebra", "Mensuration", "Mixture"];
const GK = ["BD history to 1947", "Language Movement", "Liberation War", "Constitution", "Geography of BD", "Economy", "International orgs", "Current affairs", "Sports", "Awards", "World geography"];
const ICT = ["Hardware", "Software", "Networking", "Internet", "Database", "Security", "Number systems", "MS Office", "Programming basics", "Web", "Emerging tech"];

const pick = (list: string[], day: number) => {
  const round = Math.floor((day - 1) / list.length);
  return list[(day - 1) % list.length] + (round ? ` (part ${round + 1})` : "");
};


type Q = [string, string, [string, string, string, string], string, string];
const SAMPLE: Q[] = [
  // ---- BANGLA ----
  ["BANGLA", "বাংলা ভাষা কোন ভাষা-পরিবারের অন্তর্ভুক্ত?", ["দ্রাবিড়", "অস্ট্রো-এশিয়াটিক", "সেমিটিক", "ইন্দো-ইউরোপীয়"], "D", "বাংলা ইন্দো-ইউরোপীয় ভাষা-পরিবারের ইন্দো-আর্য শাখার ভাষা।"],
  ["BANGLA", "বাংলা বর্ণমালায় মোট বর্ণের সংখ্যা কত?", ["৪৮", "৫২", "৫৪", "৫০"], "D", "বাংলা বর্ণমালায় ১১টি স্বরবর্ণ ও ৩৯টি ব্যঞ্জনবর্ণ, মোট ৫০টি বর্ণ।"],
  ["BANGLA", "নিচের কোনটি তদ্ভব শব্দ?", ["ধর্ম", "মিত্র", "হাত", "কর্ম"], "C", "'হাত' সংস্কৃত 'হস্ত' থেকে রূপ বদলে এসেছে, তাই তদ্ভব। বাকিগুলো অবিকৃত সংস্কৃত শব্দ (তৎসম)।"],
  ["BANGLA", "নিচের কোনটি দেশি শব্দ?", ["কলম", "বালতি", "ঢেঁকি", "চেয়ার"], "C", "ঢেঁকি দেশি শব্দ হিসেবে তালিকাভুক্ত। কলম আরবি, বালতি পর্তুগিজ, চেয়ার ইংরেজি।"], // REVIEW: কিছু বইয়ে ঢেঁকির উৎস নিয়ে ভিন্নমত থাকতে পারে; মিলিয়ে নাও।
  ["BANGLA", "'জানালা' শব্দটি কোন ভাষা থেকে বাংলায় এসেছে?", ["ফারসি", "আরবি", "তুর্কি", "পর্তুগিজ"], "D", "'জানালা' পর্তুগিজ 'janela' থেকে এসেছে।"],
  ["BANGLA", "'হরতাল' শব্দটি কোন ভাষা থেকে আগত?", ["গুজরাটি", "হিন্দি", "মারাঠি", "উর্দু"], "A", "'হরতাল' গুজরাটি শব্দ (hartal)। বাংলায় এটি প্রচলিত বিদেশি-ভারতীয় শব্দ।"],
  ["BANGLA", "বাংলা ভাষা কোন প্রাকৃত ধারা থেকে উদ্ভূত?", ["শৌরসেনী", "মহারাষ্ট্রী", "মাগধী", "পৈশাচী"], "C", "বাংলা ভাষার উদ্ভব মাগধী প্রাকৃত ও মাগধী অপভ্রংশ ধারা থেকে।"],
  ["BANGLA", "'ঁ' চিহ্নটির নাম কী?", ["চন্দ্রবিন্দু", "অনুস্বার", "বিসর্গ", "হসন্ত"], "A", "'ঁ' চিহ্নের নাম চন্দ্রবিন্দু। এটি অনুনাসিক স্বর বোঝায়।"],
  ["BANGLA", "যুক্তবর্ণ 'জ্ঞ' কোন কোন বর্ণের সংযোগে গঠিত?", ["জ + ঞ", "গ + ঞ", "জ + ন", "গ + ন"], "A", "জ + ঞ = জ্ঞ।"],
  ["BANGLA", "নিচের কোনটি মিশ্র শব্দ?", ["সূর্যোদয়", "মহাসাগর", "ডাক্তারখানা", "চন্দ্রসূর্য"], "C", "ডাক্তার (ইংরেজি) + খানা (ফারসি) = ডাক্তারখানা, তাই মিশ্র শব্দ। বাকিগুলো সংস্কৃত শব্দ দিয়ে গঠিত।"],
  ["BANGLA", "এক কথায় প্রকাশ করো: 'কী করা উচিত ভেবে পাচ্ছে না যে'", ["কর্তব্যনিষ্ঠ", "কিংকর্তব্যবিমূঢ়", "কর্মবিমুখ", "কিংবদন্তি"], "B", "কর্তব্য কী তা স্থির করতে না পারা ব্যক্তি কিংকর্তব্যবিমূঢ়।"],
  ["BANGLA", "'কোকিলের ডাক' এক কথায় কী?", ["কেকা", "কুহু", "হেষা", "বৃংহণ"], "B", "কোকিলের ডাক কুহু; কেকা ময়ূরের, হেষা ঘোড়ার, বৃংহণ হাতির ডাক।"],
  ["BANGLA", "এক কথায় প্রকাশ করো: 'আকাশে বিচরণ করে যে'", ["জলচর", "উভচর", "নিশাচর", "খেচর"], "D", "আকাশে চরে যে খেচর। জলে চরে জলচর, রাতে চরে নিশাচর।"], // REVIEW: কিছু তালিকায় 'খচর' বানানে লেখা থাকে; বানানটি মিলিয়ে নাও।
  ["BANGLA", "এক কথায় প্রকাশ করো: 'গুণের আদর করে যে'", ["গুণধর", "গুণবান", "গুণগ্রাহী", "গুণাকর"], "C", "গুণের কদর করে যে, সে গুণগ্রাহী।"],
  ["BANGLA", "'যা গ্রহণ করা যায়' এক কথায় কী?", ["গ্রাহক", "গ্রাহ্য", "গ্রহীতা", "গ্রস্ত"], "B", "গ্রহণের যোগ্য যা, তা গ্রাহ্য।"],
  ["BANGLA", "'খনি থেকে উৎপন্ন যা' এক কথায় কী?", ["উদ্ভিজ", "ভূজ", "খনিজ", "জলজ"], "C", "খনি থেকে জাত যা, তা খনিজ।"],
  ["BANGLA", "'গোপনে সংবাদ সংগ্রহ করে যে' এক কথায় কী?", ["সংবাদদাতা", "গুপ্তচর", "প্রতিবেদক", "দূত"], "B", "গোপনে খবর সংগ্রহ করে যে চর, সে গুপ্তচর।"],
  ["BANGLA", "'কানন' শব্দের সমার্থক শব্দ কোনটি?", ["সরোবর", "অরণ্য", "পর্বত", "সাগর"], "B", "কানন অর্থ বন; সমার্থক শব্দ অরণ্য।"],
  ["BANGLA", "'কন্যা' শব্দের সমার্থক শব্দ কোনটি?", ["তনয়া", "সুত", "ভগিনী", "বধূ"], "A", "কন্যার সমার্থক তনয়া, দুহিতা, আত্মজা। 'সুত' পুত্র।"],
  ["BANGLA", "'খগ' শব্দের সমার্থক শব্দ কোনটি?", ["মৃগ", "ভুজঙ্গ", "অলি", "বিহঙ্গ"], "D", "খগ অর্থ পাখি; সমার্থক বিহঙ্গ। মৃগ হরিণ, ভুজঙ্গ সাপ, অলি ভ্রমর।"],
  ["BANGLA", "'গিরি' শব্দের সমার্থক শব্দ কোনটি?", ["জলধি", "তরু", "ভূধর", "অম্বর"], "C", "গিরি অর্থ পাহাড়; সমার্থক ভূধর, শৈল, অচল।"],
  ["BANGLA", "'কৃপণ' শব্দের বিপরীত শব্দ কোনটি?", ["বিমুখ", "ধনী", "বদান্য", "কঠিন"], "C", "কৃপণের বিপরীত বদান্য (দানশীল, উদার)।"],
  ["BANGLA", "'কুটিল' শব্দের বিপরীত শব্দ কোনটি?", ["সরল", "বক্র", "জটিল", "কপট"], "A", "কুটিলের বিপরীত সরল।"],
  ["BANGLA", "'গৌণ' শব্দের বিপরীত শব্দ কোনটি?", ["অপ্রধান", "মুখ্য", "নগণ্য", "তুচ্ছ"], "B", "গৌণের বিপরীত মুখ্য। বাকিগুলো গৌণের কাছাকাছি অর্থের শব্দ।"],
  ["BANGLA", "'কৃতজ্ঞ' শব্দের বিপরীত শব্দ কোনটি?", ["কৃতঘ্ন", "কৃতী", "কৃতার্থ", "কৃতকর্মা"], "A", "কৃতজ্ঞের বিপরীত কৃতঘ্ন (অকৃতজ্ঞ)।"],
  // ---- ENGLISH ----
  ["ENGLISH", "Which of the following is an abstract noun?", ["Wisdom", "Child", "Cotton", "Dhaka"], "A", "Wisdom একটি গুণ বা ভাব, যা স্পর্শ করা যায় না, তাই abstract noun।"],
  ["ENGLISH", "What is the plural form of 'phenomenon'?", ["phenomenons", "phenomenas", "phenomenae", "phenomena"], "D", "Phenomenon-এর plural phenomena (গ্রিক উৎসের শব্দ)।"],
  ["ENGLISH", "What is the plural form of 'sister-in-law'?", ["sister-in-laws", "sisters-in-laws", "sister's-in-law", "sisters-in-law"], "D", "Compound noun-এ মূল noun (sister) বহুবচন হয়: sisters-in-law।"],
  ["ENGLISH", "Between you and ___, this plan is quite risky.", ["I", "myself", "me", "mine"], "C", "Preposition (between)-এর পরে object case বসে, তাই 'me'।"],
  ["ENGLISH", "He hurt ___ while playing cricket.", ["him", "his", "himself", "he"], "C", "কর্তা ও কর্ম একই ব্যক্তি হলে reflexive pronoun 'himself' হয়।"],
  ["ENGLISH", "Neither of the two brothers ___ finished his homework.", ["has", "have", "are", "were"], "A", "'Neither of' এর পর singular verb বসে, তাই 'has'।"],
  ["ENGLISH", "___ did you invite to the wedding?", ["Whom", "Who", "Whose", "Which"], "A", "Invite-এর object প্রয়োজন, তাই formal grammar-এ 'Whom'।"], // REVIEW: কথ্য ইংরেজিতে 'Who' চলে, কিন্তু পরীক্ষার প্রচলিত উত্তর 'Whom'।
  ["ENGLISH", "The man ___ car was stolen reported the matter to the police.", ["who", "whose", "whom", "which"], "B", "মালিকানা বোঝাতে possessive relative pronoun 'whose' বসে।"],
  ["ENGLISH", "What is the feminine gender of 'fox'?", ["foxess", "vixen", "vixer", "foxette"], "B", "Fox-এর স্ত্রীলিঙ্গ vixen।"],
  ["ENGLISH", "Which of the following nouns is always used in the plural form?", ["Scissors", "Advice", "Furniture", "Information"], "A", "Scissors সবসময় plural হিসেবে ব্যবহৃত হয়। বাকিগুলো uncountable noun।"],
  ["ENGLISH", "Choose the grammatically correct sentence.", ["She gave me some good advices.", "He bought new furniture for his house.", "The news are surprising.", "I need some informations about the course."], "B", "Furniture uncountable, তাই s যুক্ত হয় না। Advice ও information-ও uncountable, আর news singular verb নেয়।"],
  ["ENGLISH", "In the sentence 'The committee has announced its decision', the noun 'committee' is a/an ___ noun.", ["abstract", "material", "collective", "proper"], "C", "একাধিক সদস্যের দল বোঝায় বলে committee একটি collective noun।"],
  ["ENGLISH", "Choose the word closest in meaning to 'ameliorate'.", ["worsen", "improve", "delay", "punish"], "B", "Ameliorate = make better (উন্নত করা)। [Vocab 32]"],
  ["ENGLISH", "The teacher admonished the boy for coming late. Here, 'admonished' means —", ["reprimanded", "rewarded", "applauded", "ignored"], "A", "Admonish = scold or reprimand (তিরস্কার করা)। [Vocab 15]"],
  ["ENGLISH", "'Abscond' means —", ["to refuse politely", "to gather together", "to reduce gradually", "to flee secretly"], "D", "Abscond = run away secretly, often to avoid arrest। [Vocab 7]"],
  ["ENGLISH", "Choose the antonym of 'affinity'.", ["antipathy", "kinship", "attraction", "similarity"], "A", "Affinity = natural attraction; বিপরীত antipathy (তীব্র অপছন্দ)। [Vocab 19, 44]"],
  ["ENGLISH", "Choose the antonym of 'appease'.", ["pacify", "soothe", "provoke", "placate"], "C", "Appease = শান্ত করা; বিপরীত provoke (উত্তেজিত করা)। বাকিগুলো সমার্থক। [Vocab 49]"],
  ["ENGLISH", "His reply was so ___ that no one could tell whether he agreed or not.", ["adamant", "analogous", "amenable", "ambiguous"], "D", "Ambiguous = একাধিক অর্থ হতে পারে এমন, অস্পষ্ট। [Vocab 29]"],
  ["ENGLISH", "She remained adamant despite everyone's requests. Here, 'adamant' means —", ["unyielding", "flexible", "hesitant", "careless"], "A", "Adamant = অনমনীয়, নিজের সিদ্ধান্তে অটল। [Vocab 13]"],
  ["ENGLISH", "'The voters' apathy led to a very low turnout.' Here, 'apathy' means —", ["lack of interest", "intense anger", "great joy", "deep respect"], "A", "Apathy = আগ্রহ বা আবেগের অভাব, উদাসীনতা। [Vocab 45]"],
  ["ENGLISH", "Choose the correctly spelled word.", ["abstenence", "abstinence", "abstinance", "abstinense"], "B", "সঠিক বানান abstinence। [Vocab 9]"],
  ["ENGLISH", "'The news came like a bolt from the blue.' The idiom means —", ["a long-awaited announcement", "a pleasant gift", "a completely unexpected shock", "a gradual change"], "C", "Bolt from the blue = বিনা মেঘে বজ্রপাত। [Phrase 9]"],
  ["ENGLISH", "'A black sheep' means —", ["a rare and valuable animal", "a disgraced member of a family or group", "a wealthy landowner", "a faithful servant"], "B", "A black sheep = কুলাঙ্গার। [Phrase 8]"],
  ["ENGLISH", "Which proverb conveys the idea that too much greed ruins everything?", ["Look before you leap.", "Grasp all, lose all.", "Waste not, want not.", "Pride goes before a fall."], "B", "'অতি লোভে তাঁতি নষ্ট' = Grasp all, lose all। [Proverb 4]"],
  ["ENGLISH", "Complete the proverb: '___ not, want not.'", ["Spend", "Earn", "Waste", "Save"], "C", "'অপচয় করো না, অভাবে পড়বে না' = Waste not, want not। [Proverb 6]"],
  // ---- MATH ----
  ["MATH", "What is 40% of 250?", ["80", "90", "100", "120"], "C", "250 × 40/100 = 100।"],
  ["MATH", "Express 3/8 as a percentage.", ["35%", "37.5%", "38.5%", "40%"], "B", "3/8 × 100 = 37.5%।"],
  ["MATH", "If 20% of a number is 48, what is the number?", ["240", "250", "300", "320"], "A", "সংখ্যা = 48 × 100/20 = 240।"],
  ["MATH", "A number increased by 25% becomes 150. What is the number?", ["90", "100", "110", "120"], "D", "সংখ্যার 125% = 150, তাই সংখ্যা = 150 × 100/125 = 120।"],
  ["MATH", "The salary of A is 25% more than that of B. By what percent is B's salary less than A's?", ["20%", "24%", "25%", "30%"], "A", "B = 100 হলে A = 125। কমতি 25/125 × 100 = 20%।"],
  ["MATH", "The population of a town is 20,000. It increases by 10% in the first year and by 20% in the second year. What is the population after two years?", ["25,000", "26,000", "26,400", "27,000"], "C", "20,000 × 1.1 × 1.2 = 26,400।"],
  ["MATH", "If the price of sugar rises by 25%, by what percent must a family cut its consumption so that the expenditure remains unchanged?", ["10%", "15%", "18%", "20%"], "D", "বৃদ্ধি 25% হলে হ্রাস = 25/125 × 100 = 20%।"],
  ["MATH", "In an election between two candidates, one candidate got 45% of the total votes and lost by 300 votes. What was the total number of votes cast? (No vote was invalid.)", ["2,500", "3,000", "3,500", "4,000"], "B", "বিজয়ী 55%, পরাজিত 45%; পার্থক্য 10% = 300। মোট = 3,000।"],
  ["MATH", "In an exam, 70% of the students passed in Bangla, 65% passed in English and 50% passed in both. What percent failed in both subjects?", ["15%", "20%", "25%", "30%"], "A", "অন্তত একটিতে পাস = 70 + 65 − 50 = 85%। দুটোতেই ফেল = 15%।"],
  ["MATH", "A student needs 40% marks to pass. He scored 120 marks and failed by 40 marks. What are the total marks?", ["300", "350", "400", "450"], "C", "পাস নম্বর = 120 + 40 = 160, যা মোটের 40%। মোট = 160 × 100/40 = 400।"],
  ["MATH", "The length of a rectangle is increased by 20% and its width is decreased by 20%. What is the change in its area?", ["No change", "4% decrease", "4% increase", "2% decrease"], "B", "নতুন ক্ষেত্রফল = 1.2 × 0.8 = 0.96, অর্থাৎ 4% হ্রাস।"],
  ["MATH", "What single discount is equivalent to two successive discounts of 10% and 20%?", ["20%", "25%", "26%", "28%"], "D", "100 → 90 → 72। মোট ছাড় = 28%।"],
  ["MATH", "What percent of 1.5 km is 600 metres?", ["30%", "35%", "40%", "45%"], "C", "1.5 km = 1500 m। 600/1500 × 100 = 40%।"],
  ["MATH", "In a class of 60 students, 40% are girls. If 25% of the boys are absent today, how many boys are present?", ["27", "30", "33", "36"], "A", "মেয়ে = 24, ছেলে = 36। অনুপস্থিত 9, উপস্থিত 27।"],
  ["MATH", "A man spends 60% of his income and saves Tk 8,000. What is his income?", ["Tk 16,000", "Tk 20,000", "Tk 24,000", "Tk 30,000"], "B", "সঞ্চয় 40% = 8,000, তাই আয় = 8,000 × 100/40 = 20,000।"],
  ["MATH", "The price of a book was reduced from Tk 250 to Tk 200. What is the percentage reduction?", ["15%", "18%", "20%", "25%"], "C", "কমেছে 50 টাকা। 50/250 × 100 = 20%।"],
  ["MATH", "A 40-litre mixture contains 25% milk. How many litres of pure milk must be added to make the milk content 40%?", ["5", "6", "8", "10"], "D", "দুধ = 10 L। x লিটার যোগ করলে (10+x)/(40+x) = 0.4 ⇒ x = 10।"],
  ["MATH", "In an election, 5,000 voters were registered. 20% did not vote, and 10% of the votes cast were invalid. If the winner got 60% of the valid votes, how many valid votes did the winner get?", ["2,000", "2,160", "2,400", "2,700"], "B", "ভোট পড়েছে 4,000; বৈধ 3,600। বিজয়ী পেয়েছে 3,600 × 60% = 2,160।"],
  ["MATH", "If 40% of A equals 60% of B, then A : B = ?", ["3 : 2", "2 : 3", "5 : 4", "4 : 5"], "A", "0.4A = 0.6B ⇒ A/B = 0.6/0.4 = 3/2।"],
  ["MATH", "A fruit seller sold 40% of his apples on the first day and 50% of the remaining on the second day. If 180 apples were left, how many apples did he have at first?", ["300", "450", "500", "600"], "D", "প্রথম দিনের পর থাকে 60%, দ্বিতীয় দিনের পর 30%। 30% = 180 ⇒ মোট = 600।"],
  // ---- GK ----
  ["GK", "In which year did the English East India Company receive its royal charter?", ["1498", "1664", "1600", "1757"], "C", "রানি প্রথম এলিজাবেথের কাছ থেকে ১৬০০ সালে ইংরেজ ইস্ট ইন্ডিয়া কোম্পানি রাজকীয় সনদ পায়।"],
  ["GK", "Who is traditionally regarded as the founder of the city of Calcutta (1690)?", ["Job Charnock", "Robert Clive", "Warren Hastings", "Lord Cornwallis"], "A", "ঐতিহ্যগতভাবে জব চার্নক কলকাতার প্রতিষ্ঠাতা হিসেবে স্বীকৃত।"], // REVIEW: ১৬৯০ সালের তারিখ নিয়ে ঐতিহাসিকদের মধ্যে বিতর্ক আছে; 'ঐতিহ্যগতভাবে' শব্দটি রেখে যাচাই করো।
  ["GK", "In which year was the Battle of Plassey fought?", ["1764", "1765", "1793", "1757"], "D", "পলাশীর যুদ্ধ হয় ২৩ জুন ১৭৫৭ সালে।"],
  ["GK", "Who was the commander-in-chief of Nawab Siraj-ud-Daulah who betrayed him in the Battle of Plassey?", ["Mir Qasim", "Mohanlal", "Alivardi Khan", "Mir Jafar"], "D", "মীর জাফর নবাবের সেনাপতি থেকেও ইংরেজদের সঙ্গে ষড়যন্ত্র করেন।"],
  ["GK", "In which year was the Battle of Buxar fought?", ["1757", "1764", "1765", "1773"], "B", "বক্সারের যুদ্ধ ১৭৬৪ সালে হয়।"],
  ["GK", "In 1765, who granted the Diwani (revenue rights) of Bengal, Bihar and Orissa to the East India Company?", ["Emperor Aurangzeb", "Bahadur Shah Zafar", "Nawab Siraj-ud-Daulah", "Emperor Shah Alam II"], "D", "১৭৬৫ সালে সম্রাট দ্বিতীয় শাহ আলম কোম্পানিকে দেওয়ানি প্রদান করেন।"],
  ["GK", "The Permanent Settlement in Bengal was introduced in 1793 by —", ["Warren Hastings", "Lord Dalhousie", "Lord Wellesley", "Lord Cornwallis"], "D", "১৭৯৩ সালে লর্ড কর্নওয়ালিস চিরস্থায়ী বন্দোবস্ত চালু করেন।"],
  ["GK", "Who built the famous bamboo fort at Narkelbaria against the British in 1831?", ["Titumir", "Dudu Miyan", "Haji Shariatullah", "Syed Ahmad Barelvi"], "A", "তিতুমীর ১৮৩১ সালে নারিকেলবাড়িয়ায় বাঁশের কেল্লা তৈরি করেন।"],
  ["GK", "Who was the founder of the Faraizi movement in Bengal?", ["Titumir", "Haji Shariatullah", "Nawab Abdul Latif", "Dudu Miyan"], "B", "হাজী শরীয়তউল্লাহ ফরায়েজি আন্দোলনের প্রতিষ্ঠাতা; পরে দুদু মিয়া নেতৃত্ব দেন।"],
  ["GK", "Who wrote the play 'Nil Darpan' (1860), based on the sufferings of indigo farmers?", ["Bankim Chandra Chattopadhyay", "Girish Chandra Ghosh", "Dwijendralal Ray", "Dinabandhu Mitra"], "D", "নীল বিদ্রোহের পটভূমিতে দীনবন্ধু মিত্র 'নীলদর্পণ' লেখেন।"],
  ["GK", "The Great Revolt (Sepoy Mutiny) of 1857 began at —", ["Delhi", "Lucknow", "Meerut", "Jhansi"], "C", "১৮৫৭ সালের সিপাহি বিদ্রোহ ১০ মে মিরাটে শুরু হয়।"],
  ["GK", "Who partitioned Bengal in 1905?", ["Lord Minto", "Lord Hardinge", "Lord Curzon", "Lord Mountbatten"], "C", "১৯০৫ সালে ভাইসরয় লর্ড কার্জন বঙ্গভঙ্গ করেন।"],
  ["GK", "Which city became the capital of the new province 'Eastern Bengal and Assam' created in 1905?", ["Calcutta", "Dacca", "Guwahati", "Murshidabad"], "B", "নতুন প্রদেশ পূর্ববঙ্গ ও আসামের রাজধানী হয় ঢাকা।"],
  ["GK", "Which Nawab of Dhaka played a leading role in founding the All India Muslim League in 1906?", ["Nawab Abdul Latif", "Syed Ameer Ali", "Sir Syed Ahmad Khan", "Nawab Khwaja Salimullah"], "D", "১৯০৬ সালে ঢাকায় মুসলিম লীগ প্রতিষ্ঠায় নবাব খাজা সলিমুল্লাহ অগ্রণী ভূমিকা রাখেন।"],
  ["GK", "In which year was the annulment of the Partition of Bengal announced?", ["1906", "1909", "1911", "1917"], "C", "১৯১১ সালের দিল্লি দরবারে বঙ্গভঙ্গ রদের ঘোষণা দেওয়া হয়।"],
  ["GK", "In which year was the University of Dhaka established?", ["1911", "1930", "1921", "1947"], "C", "ঢাকা বিশ্ববিদ্যালয় ১৯২১ সালের ১ জুলাই যাত্রা শুরু করে।"],
  ["GK", "Who moved the historic Lahore Resolution in 1940?", ["A. K. Fazlul Huq", "Khwaja Nazimuddin", "H. S. Suhrawardy", "Liaquat Ali Khan"], "A", "১৯৪০ সালের লাহোর প্রস্তাব উত্থাপন করেন এ. কে. ফজলুল হক।"],
  ["GK", "The Great Bengal Famine ('Panchasher Manwantar') took place in which year?", ["1770", "1876", "1947", "1943"], "D", "পঞ্চাশের মন্বন্তর (১৩৫০ বঙ্গাব্দ) ঘটে ১৯৪৩ সালে।"],
  ["GK", "In July 1947, a referendum was held in which district to decide whether to join East Bengal (Pakistan) or Assam (India)?", ["Sylhet", "Comilla", "Rangpur", "Rajshahi"], "A", "১৯৪৭ সালের জুলাইয়ে গণভোটের মাধ্যমে সিলেট পূর্ববঙ্গে (পাকিস্তানে) যোগ দেয়।"],
  ["GK", "Who chaired the Boundary Commissions that drew the border of Bengal and Punjab in 1947?", ["Lord Mountbatten", "Sir Cyril Radcliffe", "Sir Stafford Cripps", "Lord Wavell"], "B", "সীমানা কমিশনের সভাপতি ছিলেন সিরিল র‍্যাডক্লিফ; তাঁর টানা রেখাই র‍্যাডক্লিফ রোয়েদাদ।"],
  // ---- ICT ----
  ["ICT", "What does CPU stand for?", ["Central Program Unit", "Computer Processing Unit", "Central Peripheral Unit", "Central Processing Unit"], "D", "CPU = Central Processing Unit, কম্পিউটারের মস্তিষ্ক।"],
  ["ICT", "Which component of the CPU performs arithmetic and logical operations?", ["Control Unit", "Register", "ALU", "Cache"], "C", "ALU (Arithmetic Logic Unit) যোগ-বিয়োগ ও তুলনার মতো গাণিতিক ও যৌক্তিক কাজ করে।"],
  ["ICT", "Which part of the CPU directs the flow of data and instructions among the components of a computer?", ["ALU", "Control Unit", "Cache memory", "Power supply unit"], "B", "Control Unit নির্দেশ আনা, বোঝা ও কাজের সমন্বয় (fetch–decode–execute) নিয়ন্ত্রণ করে।"],
  ["ICT", "Which of the following is an input device?", ["Printer", "Speaker", "Projector", "Scanner"], "D", "Scanner কম্পিউটারে তথ্য ঢোকায়, তাই input device।"],
  ["ICT", "Which of the following is an output device?", ["Light pen", "Plotter", "Joystick", "Microphone"], "B", "Plotter বড় নকশা ও ছবি প্রিন্ট করে, তাই output device।"],
  ["ICT", "The speed of a CPU is measured in —", ["Bits per second (bps)", "Hertz (Hz)", "Pixels per inch (ppi)", "Dots per inch (dpi)"], "B", "CPU-এর ক্লক স্পিড হার্জ (Hz/GHz)-এ মাপা হয়।"],
  ["ICT", "Which of the following is the fastest memory in a computer?", ["Registers", "Hard disk", "RAM", "Cache"], "A", "CPU-এর ভেতরের রেজিস্টার সবচেয়ে দ্রুত মেমোরি, তারপর cache।"],
  ["ICT", "Which technology do banks use to read the special magnetic-ink characters printed on cheques?", ["OCR", "OMR", "Barcode reader", "MICR"], "D", "MICR (Magnetic Ink Character Recognition) ব্যাংকে চেক প্রসেস করতে ব্যবহৃত হয়।"],
  ["ICT", "A touchscreen is an example of —", ["both an input and an output device", "an input device only", "an output device only", "a storage device"], "A", "টাচস্ক্রিন স্পর্শ গ্রহণ করে (input) এবং ছবি দেখায় (output)।"],
  ["ICT", "A dual-core or quad-core processor means that —", ["the system has two or four hard disks", "the computer has two or four power supplies", "the computer can use only two or four networks", "the chip contains two or more independent processing cores"], "D", "মাল্টি-কোর প্রসেসরে একই চিপে একাধিক স্বাধীন প্রসেসিং কোর থাকে।"],
];

// word|Bangla meaning|English explanation (50 words = Day 1: 10 pages of 5)
const VOCAB = `abandon|পরিত্যাগ করা|to leave someone or something completely
abate|হ্রাস পাওয়া|to become less strong or intense
abdicate|সিংহাসন ত্যাগ করা|to give up the throne or a high position
aberration|বিচ্যুতি|a departure from what is normal or expected
abhor|ঘৃণা করা|to hate something very much
abide|মেনে চলা|to accept and follow a rule or decision
abject|শোচনীয়|extremely bad or hopeless
abolish|বিলোপ করা|to officially end a system or law
abrupt|আকস্মিক|sudden and unexpected
absolve|দায়মুক্ত করা|to declare someone free from blame
abstain|বিরত থাকা|to choose not to do something
abstract|বিমূর্ত|existing as an idea, not a physical thing
absurd|অযৌক্তিক|wildly unreasonable or silly
abundant|প্রচুর|existing in large quantities
abuse|অপব্যবহার|to use something in a wrong or harmful way
accelerate|ত্বরান্বিত করা|to move or happen faster
accessible|সহজলভ্য|easy to reach or obtain
acclaim|প্রশংসা|public praise
accomplish|সম্পন্ন করা|to succeed in finishing something
accumulate|জমা করা|to gather more and more of something
accurate|নির্ভুল|correct in every detail
accuse|অভিযুক্ত করা|to say someone has done something wrong
acknowledge|স্বীকার করা|to accept that something is true
acquire|অর্জন করা|to get or gain something
adapt|খাপ খাওয়ানো|to change to suit new conditions
adequate|যথেষ্ট|enough for a particular need
adhere|আঁকড়ে থাকা|to stick to or follow firmly
adjacent|সংলগ্ন|next to or near something
administer|পরিচালনা করা|to manage or look after
admire|প্রশংসা করা|to respect and like someone or something
adopt|গ্রহণ করা|to take up or start to use
adorn|সাজানো|to make more beautiful by decorating
advocate|সমর্থক|a person who publicly supports a cause
aesthetic|নান্দনিক|concerned with beauty
affable|অমায়িক|friendly and easy to talk to
affirm|দৃঢ়ভাবে বলা|to state firmly that something is true
afflict|কষ্ট দেওয়া|to cause pain or suffering
affluent|ধনী|having a lot of money
aggravate|আরও খারাপ করা|to make a problem worse
agile|চটপটে|able to move quickly and easily
agitate|উত্তেজিত করা|to make someone feel anxious or upset
alleviate|উপশম করা|to make pain or a problem less severe
allocate|বরাদ্দ করা|to give something out for a purpose
alloy|সংকর ধাতু|a metal made by mixing two or more metals
allude|ইঙ্গিত করা|to mention something indirectly
aloof|নির্লিপ্ত|distant and not friendly
altruism|পরার্থপরতা|caring about the welfare of others
ambiguous|দ্ব্যর্থক|having more than one possible meaning
ambition|উচ্চাকাঙ্ক্ষা|a strong wish to achieve something
amend|সংশোধন করা|to change a text or law to improve it`.split("\n").map((l) => l.split("|"));

async function main() {
  await connectDb();

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    await UserModel.updateOne(
      { email: env.ADMIN_EMAIL.toLowerCase() },
      {
        $set: { role: "SUPER_ADMIN", emailVerified: true, blocked: false },
        $setOnInsert: {
          name: "Super Admin",
          mobile: env.ADMIN_MOBILE,
          passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
        },
      },
      { upsert: true },
    );
    console.log(`Super admin ready: ${env.ADMIN_EMAIL}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set: skipped admin user.");
  }

  const cats = [
    { name: "Bank Job", slug: "bank-job", icon: "landmark", color: "yellow", sortOrder: 1 },
    { name: "Petrobangla", slug: "petrobangla", icon: "flame", color: "mint", sortOrder: 2 },
    { name: "BCS", slug: "bcs", icon: "award", color: "lime", sortOrder: 3 },
  ];
  for (const c of cats) await CategoryModel.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true });
  const bank = await CategoryModel.findOne({ slug: "bank-job" });

  const start = dhakaStartOfDay(); // Day 1 is today, so the free exam can be tried right away
  await CourseModel.updateOne(
    { slug: "bank-job-prelim" },
    {
      $setOnInsert: {
        categoryId: bank!._id,
        title: "Bank Job Prelim: 30-Day Course",
        slug: "bank-job-prelim",
        description: "Study the day's topics, then take a 100-mark live exam at 12 AM in the real prelim format.",
        durationDays: 30,
        priceBdt: 499,
        freeDays: 1,
        startDate: start,
        status: "LIVE",
      },
    },
    { upsert: true },
  );
  const course = await CourseModel.findOne({ slug: "bank-job-prelim" });

  for (let day = 1; day <= 30; day++) {
    const type = day <= 22 ? "TOPIC" : day <= 26 ? "FINAL" : "MODEL";
    const subjectTopics =
      type === "TOPIC"
        ? { bangla: pick(BANGLA, day), english: pick(ENGLISH, day), math: pick(MATH, day), gk: pick(GK, day), ict: pick(ICT, day) }
        : type === "FINAL"
          ? { bangla: "Full Bangla", english: "Full English", math: "Full Math", gk: "Full GK", ict: "Full ICT" }
          : Object.fromEntries(["bangla", "english", "math", "gk", "ict"].map((k) => [k, `Model test ${day - 26}`]));
    await RoutineDayModel.updateOne(
      { courseId: course!._id, dayNo: day },
      {
        $setOnInsert: {
          courseId: course!._id,
          dayNo: day,
          date: addDays(start, day - 1),
          type,
          topics: subjectTopics,
          ...(day <= 22 ? { vocabFrom: (day - 1) * 50 + 1, vocabTo: day * 50 } : {}),
        },
      },
      { upsert: true },
    );
  }

  await ensureExams(course!._id);
  const day1 = await ExamModel.findOne({ courseId: course!._id, dayNo: 1 });
  if (day1) {
    // $set (not $setOnInsert) so re-running the seed replaces any older Day 1 questions with these 100.
    await QuestionModel.bulkWrite(SAMPLE.map(([subject, text, o, answer, explanation], i) => ({
      updateOne: {
        filter: { examId: day1._id, no: i + 1 },
        update: {
          $set: { subject, text, options: { A: o[0], B: o[1], C: o[2], D: o[3] }, answer, explanation },
          $setOnInsert: { examId: day1._id, no: i + 1 },
        },
        upsert: true,
      },
    })));
  }

  await VocabPageModel.bulkWrite(Array.from({ length: 10 }, (_, i) => ({
    updateOne: {
      filter: { courseId: course!._id, dayNo: 1, pageNo: i + 1 },
      update: { $setOnInsert: { courseId: course!._id, dayNo: 1, pageNo: i + 1, words: VOCAB.slice(i * 5, i * 5 + 5).map(([word, banglaMeaning, englishExplanation]) => ({ word, banglaMeaning, englishExplanation })) } },
      upsert: true,
    },
  })));

  const settings = { bkash_number: "01XXXXXXXXX", nagad_number: "01XXXXXXXXX", support_contact: "", site_name: "Meritlab" };
  for (const [_id, value] of Object.entries(settings)) {
    await SettingModel.updateOne({ _id }, { $setOnInsert: { _id, value } }, { upsert: true });
  }

  console.log("Seed done: categories, Bank Job Prelim course, 30-day routine, settings, Day 1 exam with 100 questions, 50 sample vocabulary words.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});