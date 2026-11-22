/* ===================== ROLES ===================== */
// camp: wolf | village | solo ; kill: can kill (for aura seer)
const ROLES = {
  werewolf:      {camp:"wolf",    icon:"🐺", kill:1, max:6},
  blackWolf:     {camp:"wolf",    icon:"🐺", kill:1, max:1, tint:"#2b2b38"},
  talkativeWolf: {camp:"wolf",    icon:"🗣️", kill:1, max:1},
  literateWolf:  {camp:"wolf",    icon:"✒️", kill:1, max:1},
  wolfRidingHood:{camp:"wolf",    icon:"🧣", kill:1, max:1},
  whiteWolf:     {camp:"solo",    icon:"🤍", kill:1, max:1},
  mercenary:     {camp:"solo",    icon:"🗡️", kill:1, max:1},
  sickRat:       {camp:"solo",    icon:"🐀", kill:0, max:1},
  villager:      {camp:"village", icon:"🧑‍🌾", kill:0, max:10},
  seer:          {camp:"village", icon:"🔮", kill:0, max:1},
  talkativeSeer: {camp:"village", icon:"📣", kill:0, max:1},
  auraSeer:      {camp:"village", icon:"✨", kill:0, max:1},
  witch:         {camp:"village", icon:"🧪", kill:1, max:1},
  healerWitch:   {camp:"village", icon:"💚", kill:0, max:1},
  poisoner:      {camp:"village", icon:"☠️", kill:1, max:1},
  hunter:        {camp:"village", icon:"🏹", kill:1, max:1},
  guard:         {camp:"village", icon:"🛡️", kill:0, max:1},
  littleGirl:    {camp:"village", icon:"👧", kill:0, max:1},
  cupid:         {camp:"village", icon:"💘", kill:0, max:1},
  redRidingHood: {camp:"village", icon:"🔴", kill:0, max:1},
  pinkRidingHood:{camp:"village", icon:"🩷", kill:0, max:1},
  blueRidingHood:{camp:"village", icon:"🔵", kill:0, max:1},
  mentalist:     {camp:"village", icon:"🧠", kill:0, max:1},
  necromancer:   {camp:"village", icon:"💀", kill:0, max:1},
  gravedigger:   {camp:"village", icon:"⚰️", kill:0, max:1},
  dictator:      {camp:"village", icon:"🎖️", kill:1, max:1},
  heir:          {camp:"village", icon:"📜", kill:0, max:1},
  plunderer:     {camp:"village", icon:"💰", kill:0, max:1},
  pyromancer:    {camp:"village", icon:"🔥", kill:1, max:1}
};
const ROLE_GROUPS = [
  ["wolf",   ["werewolf","blackWolf","talkativeWolf","literateWolf","wolfRidingHood"]],
  ["solo",   ["whiteWolf","mercenary","sickRat"]],
  ["village",["villager","seer","talkativeSeer","auraSeer","witch","healerWitch","poisoner","hunter","guard","littleGirl","cupid","redRidingHood","pinkRidingHood","blueRidingHood","mentalist","necromancer","gravedigger","dictator","heir","plunderer","pyromancer"]]
];
const SEER_ROLES = ["seer","talkativeSeer","auraSeer"];
const WITCH_ROLES = ["witch","healerWitch","poisoner"];
const WOLF_ROLES = ROLE_GROUPS[0][1];

function suggestComp(n){
  const c = {};
  const add=(r,k=1)=>c[r]=(c[r]||0)+k;
  const wolves = n<=6?1:n<=9?2:n<=12?3:4;
  add("werewolf", wolves);
  add("seer");
  if(n>=5) add("witch");
  if(n>=6) add("hunter");
  if(n>=7) add("cupid");
  if(n>=8) add("guard");
  if(n>=9) add("littleGirl");
  if(n>=10){ c.werewolf--; add("blackWolf"); }
  if(n>=11) add("whiteWolf");
  if(n>=12) add("mentalist");
  if(n>=13) add("redRidingHood");
  if(n>=14) add("gravedigger");
  if(n>=15) add("dictator");
  if(n>=16) add("talkativeWolf"), c.werewolf--;
  const tot = Object.values(c).reduce((a,b)=>a+b,0);
  if(tot<n) add("villager", n-tot);
  return c;
}
function compTotal(c){ return Object.values(c||{}).reduce((a,b)=>a+(b||0),0); }

const SPEEDS = {
  normal:{starting:10,cupid:30,heir:25,seer:25,guard:20,rat:25,pyro:20,wolves:45,witch:25,white:20,cand:45,elect:45,dictAsk:15,dict:30,vote:180,tie:20,prompt:25,dawn:4},
  fast:  {starting:8, cupid:20,heir:15,seer:18,guard:15,rat:15,pyro:15,wolves:30,witch:18,white:15,cand:30,elect:30,dictAsk:10,dict:20,vote:120,tie:15,prompt:18,dawn:3}
};
