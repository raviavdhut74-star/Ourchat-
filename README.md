# क्षण · Kshan

फोटो, रील्स, स्टोरीज, फॉलो, चॅट आणि व्हॉइस/व्हिडिओ कॉल असलेलं सोशल ॲप. जुन्या "जीवलग" (HTML/CSS/JS + Supabase) ॲपचं नवीन स्टॅकमध्ये रूपांतर.
Photos, reels, stories, follow, chat and voice/video calls. The old "Jivlag" app (plain HTML/CSS/JS + Supabase) rebuilt on an advanced stack.

| भाग / Part | तंत्रज्ञान / Technology |
|---|---|
| `web/` | React 18 + Vite (PWA) |
| `mobile/` | React Native (Expo, development build) |
| `backend/` | Node.js, Express, Socket.IO, JWT |
| MySQL | users, follows, blocks, posts, reels, stories, comments, likes, saved, history, notifications, reports |
| MongoDB | chat messages, reactions, snaps, calls, presence |
| `shared/` | API client + translations used by both web and mobile |

## भाषा / Languages

मराठी, English आणि हिन्दी (`shared/i18n/`). भाषा लॉगिन स्क्रीनवर आणि प्रोफाईल मेनू → 🌐 भाषा मध्ये बदलता येते, आणि खात्यात सेव्ह होते.
Marathi, English and Hindi. Switch on the login screen or Profile menu → Language; it is saved on the account.

**नवीन भाषा जोडणे / Add a language:** `shared/i18n/en.js` कॉपी करा (उदा. `gu.js`), values भाषांतरित करा, `shared/i18n/index.js` मध्ये एक ओळ जोडा, आणि `backend/src/routes/users.js` मधल्या भाषा-यादीत code आहे हे पाहा (`gu, kn, ta, te, bn` आधीच स्वीकारले जातात). मग `node scripts/sync-shared.mjs`.

> भाषांतर मी लिहिलं आहे. प्रसिद्ध करण्यापूर्वी ते मूळ भाषिकाकडून तपासून घ्या. / The translations were written by an AI; have a native speaker review them before launch.

## नाव आणि लोगो / Name and logo

ॲपचं नाव **क्षण (Kshan)**. ते बदलायचं असेल तर: `shared/i18n/*.js` मधला `appName`, `web/index.html`, `web/public/manifest.webmanifest`, `mobile/app.json`. लोगो: `web/public/logo.svg` (PNG चिन्हं `web/public/icon-*.png` आणि `mobile/assets/`).

## सुरू करणे / Run it

### १. सोपा मार्ग: Docker (MySQL + MongoDB + API)
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build        # API: http://localhost:4000
```

### २. हाताने / Manually
MySQL 8 आणि MongoDB 6+ चालू असू द्या.
```bash
cd backend
cp .env.example .env             # DB पासवर्ड आणि JWT_SECRET भरा
npm install
npm run dev                      # टेबल्स आपोआप तयार होतात (किंवा: npm run db:init)
```
MySQL मध्ये युजर: `CREATE USER 'kshan'@'%' IDENTIFIED BY 'kshan_pass'; GRANT ALL ON kshan.* TO 'kshan'@'%';` (डेटाबेस आपोआप तयार होतो; त्यासाठी `CREATE` परवानगी लागते). टेबल्सचं SQL: `database/schema.sql`.

### ३. वेब / Web
```bash
cd web
cp .env.example .env             # VITE_API_URL=http://localhost:4000
npm install
npm run dev                      # http://localhost:5173
npm run build                    # production फाईल्स dist/ मध्ये
```

### ४. मोबाईल / Mobile
कॉल्ससाठी `react-native-webrtc` लागतो, म्हणून **Expo Go चालणार नाही**, development build लागतो.
```bash
cd mobile
cp .env.example .env             # EXPO_PUBLIC_API_URL=http://<तुमच्या कॉम्प्युटरचा LAN IP>:4000
npm install
npm run android                  # किंवा: npm run ios (Mac)
```

`web` आणि `mobile` चालवताना `npm run sync` आपोआप `shared/` ची कॉपी करतो. `shared/` मध्ये बदल केल्यास `node scripts/sync-shared.mjs` चालवा.

## जुन्या ॲपमधून काय बदललं / What changed from Jivlag

- **Supabase → तुमचा स्वतःचा Node + MySQL + MongoDB बॅकएंड.** लॉगिन JWT वर (ईमेल / युजरनेम / मोबाईल + पासवर्ड). पासवर्ड रीसेट ईमेल लिंकने (SMTP सेट केला नाही तर लिंक सर्व्हर लॉगमध्ये छापली जाते).
- **Cloudinary → सर्व्हरवर अपलोड** (`backend/uploads/`, `UPLOAD_DIR`). फाईल मर्यादा १०० MB. मोठ्या प्रमाणासाठी S3/CDN वापरा.
- **रिअलटाइम:** Supabase subscriptions ऐवजी Socket.IO (संदेश, टायपिंग, ऑनलाइन, अ‍ॅक्टिव्हिटी, कॉल सिग्नलिंग).
- **कॉल:** WebRTC तसंच. कठीण नेटवर्कसाठी `.env` मध्ये TURN सर्व्हर द्या.
- **सगळे जुने फीचर्स:** पोस्ट, रील्स, २४ तासांच्या स्टोरीज (जवळच्या मित्रांसाठी), कमेंट्स + उत्तरं + लाईक, हॅशटॅग, सेव्ह, इतिहास, फॉलो रिक्वेस्ट + खाजगी खाते, ब्लॉक, म्यूट, रिस्ट्रिक्ट, रिपोर्ट, चॅट (उत्तर, फॉरवर्ड, पिन, एडिट, डिलीट, ❤️, व्हॉइस, फाईल, एकदाच दिसणारा स्नॅप, स्ट्रीक, शोध, गॅलरी), थीम रंग, डार्क मोड, डेटा डाउनलोड, खाते निष्क्रिय करणे.
- **जुना डेटा (Supabase मधले युजर, पोस्ट, संदेश) आपोआप हलत नाही.** तो हवा असेल तर Supabase मधून export करून MySQL/MongoDB मध्ये import करावा लागेल (पासवर्ड हॅश Supabase चे आहेत, म्हणून युजरना पासवर्ड रीसेट करावा लागेल).

## सुरक्षा / Security

उत्पादनात: `JWT_SECRET` बदला, `CORS_ORIGIN` तुमच्या साइटवर मर्यादित करा, HTTPS वापरा, `backend/uploads/` चा बॅकअप ठेवा. लॉगिन/नोंदणीला प्रति-IP मर्यादा आहे (`backend/src/lib/rateLimit.js`, एका सर्व्हरसाठी).

## स्थिती / Status

हा कोड लिहिताना MySQL, MongoDB आणि npm पॅकेज डाउनलोड उपलब्ध नव्हते, म्हणून ॲप प्रत्यक्ष चालवून तपासलेलं नाही. सिंटॅक्स, import आणि भाषांतर-की तपासण्या झाल्या आहेत, पण पहिल्यांदा `npm install` नंतर चालवून पाहावं लागेल; काही छोट्या चुका निघू शकतात.
This code was written without access to MySQL, MongoDB or the npm registry, so it has not been run end to end. Syntax, import and translation-key checks pass, but expect to fix small issues on the first run.
