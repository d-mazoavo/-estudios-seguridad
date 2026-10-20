/*
 * ============================================================================
 *  AVO PAK S.A.S. — Estudios de seguridad de personal
 *  Archivo de configuración. Es el ÚNICO archivo que debe editarse.
 * ============================================================================
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaMdqGDNIfD0Af2DKYlMoG_iHOlISIWvw",
  authDomain: "avopak-estudios.firebaseapp.com",
  projectId: "avopak-estudios",
  storageBucket: "avopak-estudios.firebasestorage.app",
  messagingSenderId: "498836939458",
  appId: "1:498836939458:web:62ebd980dcb1385afe115b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

window.EST_CONFIG = {
  firebase: firebaseConfig,
  empresa: 'Avo Pak S.A.S.'
};
