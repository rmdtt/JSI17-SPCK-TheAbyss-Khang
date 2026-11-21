const firebaseConfig = {
  apiKey: "AIzaSyC81mFbDA4KWCYOWC_dxkmLKyQEtKcG81E",
  authDomain: "the-abyss-f505a.firebaseapp.com",
  projectId: "the-abyss-f505a",
  storageBucket: "the-abyss-f505a.firebasestorage.app",
  messagingSenderId: "496243990519",
  appId: "1:496243990519:web:220affb88b5b90881198f2",
  measurementId: "G-7GJ7JYB6QF"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

console.log(auth);