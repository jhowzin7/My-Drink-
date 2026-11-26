// Copie os valores da configuração do app Web em Firebase Console > Configurações do projeto.
// Os campos são públicos no navegador; a proteção das gravações vem de firestore.rules.
window.MYDRINK_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
  // Use o mesmo e-mail definido em firestore.rules e cadastrado no Firebase Authentication.
  managerEmail: ""
};
