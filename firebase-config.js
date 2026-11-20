// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB_MW5K675LVCTjqr6PaemHqqcDNmMaGXU",
  authDomain: "catatan-informasi-kuliah.firebaseapp.com",
  projectId: "catatan-informasi-kuliah",
  storageBucket: "catatan-informasi-kuliah.firebasestorage.app",
  messagingSenderId: "35348879351",
  appId: "1:35348879351:web:ad9819056f085fc46300f2",
  measurementId: "G-5W8JHYC635"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);