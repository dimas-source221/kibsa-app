import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjnrG44FvCMQiUCxk1qV2xVE12TfjBsOE",
  authDomain: "kibsa-app.firebaseapp.com",
  projectId: "kibsa-app",
  storageBucket: "kibsa-app.firebasestorage.app",
  messagingSenderId: "28824030783",
  appId: "1:28824030783:web:a32da36129629dda11328a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
