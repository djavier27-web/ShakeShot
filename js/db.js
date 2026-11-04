// Adapter tipis di atas Firebase Firestore.
// Bentuk API-nya sengaja dibuat sederhana: db.doc(path) dan db.collection(path)
// dengan get(), set(), dan onSnapshot(). Kalau mau pindah ke Supabase atau
// layanan lain, cukup tulis ulang file ini.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth, signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc as fdoc, collection as fcol,
  getDoc, setDoc, getDocs, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const wrapDoc=s=>({id:s.id,exists:s.exists(),data:()=>s.data()});
const wrapQuery=q=>({docs:q.docs.map(wrapDoc)});

export async function connectDb(){
  if(Object.values(firebaseConfig).some(v=>String(v).includes('ISI_'))){
    const e=new Error('config-belum-diisi'); e.code='config-belum-diisi'; throw e;
  }
  const app=initializeApp(firebaseConfig);
  const cred=await signInAnonymously(getAuth(app)); // tiap browser dapat id pemain sendiri
  const fs=getFirestore(app);
  const db={
    doc(path){
      const ref=fdoc(fs,path);
      return {
        get:async()=>wrapDoc(await getDoc(ref)),
        set:data=>setDoc(ref,data),
        onSnapshot:(next,error)=>onSnapshot(ref,s=>next(wrapDoc(s)),error)
      };
    },
    collection(path){
      const ref=fcol(fs,path);
      return {
        get:async()=>wrapQuery(await getDocs(ref)),
        onSnapshot:(next,error)=>onSnapshot(ref,q=>next(wrapQuery(q)),error)
      };
    }
  };
  return {db,uid:cred.user.uid};
}
