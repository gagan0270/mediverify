
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Card, Button, Input, Badge } from '../components/UI';
import { useNavigate } from 'react-router-dom';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const HealthProfileWizard: React.FC<Props> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    dob: '',
    gender: 'Male',
    bloodType: 'O+',
    allergies: [],
    medicalConditions: [],
    currentMedications: [],
    emergencyContact: { name: '', phone: '', relationship: '' }
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const addAllergy = () => {
    if (allergyInput.trim() && !profile.allergies.includes(allergyInput.trim())) {
      setProfile(p => ({ ...p, allergies: [...p.allergies, allergyInput.trim()] }));
      setAllergyInput('');
    }
  };

  const addCondition = () => {
    if (conditionInput.trim() && !profile.medicalConditions.includes(conditionInput.trim())) {
      setProfile(p => ({ ...p, medicalConditions: [...p.medicalConditions, conditionInput.trim()] }));
      setConditionInput('');
    }
  };

  const handleComplete = () => {
    if (!termsAgreed) {
      alert("Please agree to the terms to continue.");
      return;
    }
    if (!profile.emergencyContact.name || !profile.emergencyContact.phone) {
      alert("Please provide emergency contact details.");
      return;
    }
    onComplete(profile);
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8 px-4 animate-in fade-in duration-700">
      <div className="text-center space-y-2">
         <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Setup Your Profile</h1>
         <p className="text-slate-500 dark:text-slate-400 font-medium">To provide accurate safety warnings, we need your health details.</p>
      </div>

      <div className="flex justify-between items-center px-4 relative">
         {[1, 2, 3].map(i => (
           <div key={i} className={`z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all border-4 ${
             step >= i ? 'bg-blue-600 text-white border-blue-100 dark:border-blue-900' : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700'
           }`}>
             {i}
           </div>
         ))}
         <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-0">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }}></div>
         </div>
      </div>

      <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <i className="fas fa-user-circle text-blue-500"></i>
              Personal Information
            </h2>
            <Input label="Full Name" placeholder="Rajesh Singh" value={profile.fullName} onChange={e => setProfile(p => ({...p, fullName: e.target.value}))} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Input label="Date of Birth" type="date" value={profile.dob} onChange={e => setProfile(p => ({...p, dob: e.target.value}))} />
               <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Gender</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                    value={profile.gender} onChange={e => setProfile(p => ({...p, gender: e.target.value}))}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
               </div>
            </div>
            <div className="space-y-1.5">
               <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Blood Type</label>
               <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                 value={profile.bloodType} onChange={e => setProfile(p => ({...p, bloodType: e.target.value}))}>
                 {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(type => <option key={type} value={type}>{type}</option>)}
               </select>
            </div>
            <Button className="w-full" disabled={!profile.fullName || !profile.dob} onClick={next}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                <i className="fas fa-hand-holding-medical text-red-500"></i>
                Medical Allergies
              </h2>
              <div className="flex gap-2 mb-4">
                 <Input placeholder="e.g. Penicillin" value={allergyInput} onChange={e => setAllergyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAllergy()} />
                 <Button variant="secondary" onClick={addAllergy}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                 {profile.allergies.map(a => (
                   <Badge key={a}>
                      {a} 
                      <button onClick={() => setProfile(p => ({...p, allergies: p.allergies.filter(x => x !== a)}))}>
                         <i className="fas fa-times ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"></i>
                      </button>
                   </Badge>
                 ))}
                 {profile.allergies.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500 italic">No drug allergies listed...</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                <i className="fas fa-notes-medical text-blue-500"></i>
                Medical Conditions
              </h2>
              <div className="flex gap-2 mb-4">
                 <Input placeholder="e.g. Diabetes, Hypertension" value={conditionInput} onChange={e => setConditionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCondition()} />
                 <Button variant="secondary" onClick={addCondition}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                 {profile.medicalConditions.map(c => (
                   <Badge key={c} color="blue">
                      {c} 
                      <button onClick={() => setProfile(p => ({...p, medicalConditions: p.medicalConditions.filter(x => x !== c)}))}>
                         <i className="fas fa-times ml-1 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors"></i>
                      </button>
                   </Badge>
                 ))}
                 {profile.medicalConditions.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500 italic">No medical conditions listed...</p>}
              </div>
            </div>

            <div className="flex gap-4 pt-6">
               <Button variant="ghost" onClick={back}>Back</Button>
               <Button className="flex-grow" onClick={next}>Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
               <i className="fas fa-phone-alt text-green-500"></i>
               Emergency Contact
            </h2>
            <Input label="Contact Name" placeholder="Contact Name" value={profile.emergencyContact.name} 
              onChange={e => setProfile(p => ({...p, emergencyContact: {...p.emergencyContact, name: e.target.value}}))} />
            <Input label="Phone Number" placeholder="+91 00000 00000" value={profile.emergencyContact.phone} 
              onChange={e => setProfile(p => ({...p, emergencyContact: {...p.emergencyContact, phone: e.target.value}}))} />
            <Input label="Relationship" placeholder="Spouse, Parent, etc." value={profile.emergencyContact.relationship} 
              onChange={e => setProfile(p => ({...p, emergencyContact: {...p.emergencyContact, relationship: e.target.value}}))} />
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-2 mb-6">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    className="w-5 h-5 accent-blue-600 cursor-pointer" 
                    checked={termsAgreed}
                    onChange={e => setTermsAgreed(e.target.checked)}
                  />
                  <label htmlFor="terms" className="text-xs text-slate-500 dark:text-slate-400 font-medium cursor-pointer">
                    I confirm that all health information provided is accurate to the best of my knowledge.
                  </label>
               </div>
               <div className="flex gap-4">
                 <Button variant="ghost" onClick={back}>Back</Button>
                 <Button 
                    className="flex-grow" 
                    disabled={!profile.emergencyContact.name || !profile.emergencyContact.phone || !termsAgreed}
                    onClick={handleComplete}
                 >
                    Complete Profile
                 </Button>
               </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default HealthProfileWizard;
