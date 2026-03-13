// Single source of truth for all CSV import blueprints.
// Used by ImportModal to generate bot prompts, CSV templates, and API calls.

export interface BlueprintColumn {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
}

export interface Blueprint {
  label: string;
  apiEndpoint: string;
  columns: BlueprintColumn[];
  exampleRows: Record<string, string>[];
  botPrompt: string;
}

export const BLUEPRINTS: Record<string, Blueprint> = {
  muscles: {
    label: "Partie (Tréning)",
    apiEndpoint: "/api/import/muscles",
    columns: [
      { key: "name", label: "Názov partie", required: true, description: "Napr. Hrudník, Chrbát, Nohy" },
    ],
    exampleRows: [
      { name: "Hrudník" },
      { name: "Chrbát" },
      { name: "Nohy" },
      { name: "Ramená" },
    ],
    botPrompt: `Vytvor CSV súbor so zoznamom tréningových partií. Formát:

name
Hrudník
Chrbát
Nohy
Ramená
Bicepsy
Tricepsy

Pravidlá:
- Prvý riadok musí byť hlavička: name
- Jeden názov partie na riadok
- Bez diaľkovníkových znakov v kódovaní ak máš problémy, použij UTF-8`,
  },

  exercises: {
    label: "Cviky (Tréning)",
    apiEndpoint: "/api/import/exercises",
    columns: [
      { key: "muscle_group", label: "Svalová skupina", required: true, description: "Musí zodpovedať existujúcej partii" },
      { key: "name", label: "Názov cviku", required: true, description: "Napr. Bench Press, Pull-ups" },
    ],
    exampleRows: [
      { muscle_group: "Hrudník", name: "Bench Press" },
      { muscle_group: "Hrudník", name: "Incline Dumbbell Press" },
      { muscle_group: "Chrbát", name: "Pull-ups" },
      { muscle_group: "Chrbát", name: "Barbell Row" },
      { muscle_group: "Nohy", name: "Squat" },
    ],
    botPrompt: `Vytvor CSV súbor so zoznamom tréningových cvikov. Formát:

muscle_group,name
Hrudník,Bench Press
Hrudník,Incline Dumbbell Press
Hrudník,Cable Fly
Chrbát,Pull-ups
Chrbát,Barbell Row
Nohy,Squat
Nohy,Leg Press
Ramená,Overhead Press

Pravidlá:
- Prvý riadok musí byť hlavička: muscle_group,name
- muscle_group musí presne zodpovedať názvu existujúcej partie v aplikácii
- name je názov cviku
- Kódovanie: UTF-8`,
  },

  sessions: {
    label: "Tréningy (História)",
    apiEndpoint: "/api/import/sessions",
    columns: [
      { key: "date", label: "Dátum", required: true, description: "Formát YYYY-MM-DD" },
      { key: "muscle_groups", label: "Partie", required: false, description: "Oddelené čiarkou (bez medzier), napr. Hrudník,Chrbát" },
      { key: "exercise_name", label: "Cvik", required: false, description: "Musí existovať v cvikoch" },
      { key: "sets", label: "Sety", required: false, description: "Číslo" },
      { key: "reps", label: "Opakovania", required: false, description: "Číslo" },
      { key: "weight_kg", label: "Váha (kg)", required: false, description: "Číslo s desatinnou bodkou" },
      { key: "notes", label: "Poznámky", required: false, description: "Text (bez čiarky)" },
    ],
    exampleRows: [
      { date: "2024-01-15", muscle_groups: "Hrudník", exercise_name: "Bench Press", sets: "4", reps: "8", weight_kg: "80", notes: "Dobry trening" },
      { date: "2024-01-15", muscle_groups: "Hrudník", exercise_name: "Incline Press", sets: "3", reps: "10", weight_kg: "60", notes: "" },
      { date: "2024-01-17", muscle_groups: "Chrbát", exercise_name: "Pull-ups", sets: "4", reps: "10", weight_kg: "", notes: "" },
    ],
    botPrompt: `Vytvor CSV súbor s históriou tréningov. Formát:

date,muscle_groups,exercise_name,sets,reps,weight_kg,notes
2024-01-15,Hrudník,Bench Press,4,8,80,Dobry trening
2024-01-15,Hrudník,Incline Press,3,10,60,
2024-01-17,Chrbát,Pull-ups,4,10,,
2024-01-17,Chrbát,Barbell Row,4,8,70,

Pravidlá:
- Jeden riadok = jeden cvik v tréningu
- Viac cvikov na ten istý dátum = viac riadkov s rovnakým date
- muscle_groups: oddelené čiarkou bez medzier (napr. Hrudník,Chrbát)
- exercise_name musí existovať v cvikoch
- sets/reps/weight_kg môžu byť prázdne
- notes nesmie obsahovať čiarku
- Formát dátumu: YYYY-MM-DD`,
  },

  pantry: {
    label: "Kuchyňa (Potraviny)",
    apiEndpoint: "/api/import/pantry",
    columns: [
      { key: "name", label: "Názov", required: true, description: "Napr. Mlieko, Vajcia" },
      { key: "category", label: "Kategória", required: false, description: "ovocie, zelenina, mäso, ryby, vajcia, mliečne výrobky, obilniny, prílohy, strukoviny, orechy a semienka, pečivo, raňajkové jedlá, hotové jedlá, polotovary, snacky, sladkosti, oleje a tuky, omáčky, koreniny, nápoje, iné" },
      { key: "tier", label: "Tier", required: false, description: "S+, S, A, B, C alebo D" },
    ],
    exampleRows: [
      { name: "Mlieko", category: "Mliecne", tier: "A" },
      { name: "Vajcia", category: "Mliecne", tier: "S" },
      { name: "Chlieb", category: "Pecivo", tier: "B" },
      { name: "Maslo", category: "Mliecne", tier: "" },
      { name: "Paradajky", category: "Zelenina", tier: "S+" },
    ],
    botPrompt: `Vytvor CSV súbor so zoznamom potravín do kuchyne. Formát:

name,category,tier
Mlieko,mliečne výrobky,A
Vajcia,vajcia,S
Chlieb,pečivo,B
Maslo,mliečne výrobky,
Ryža,prílohy,B
Paradajky,zelenina,S+
Kuracie prsia,mäso,S
Olivový olej,oleje a tuky,A
Mandle,orechy a semienka,S
Ovsené vločky,raňajkové jedlá,A

Pravidlá:
- Prvý riadok musí byť hlavička: name,category,tier
- name je názov potraviny (povinné)
- category musí byť jedna z: ovocie, zelenina, mäso, ryby, vajcia, mliečne výrobky, obilniny, prílohy, strukoviny, orechy a semienka, pečivo, raňajkové jedlá, hotové jedlá, polotovary, snacky, sladkosti, oleje a tuky, omáčky, koreniny, nápoje, iné
- tier je hodnotenie kvality: S+, S, A, B, C, D (voliteľné, môže byť prázdne)
- Bez úvodzoviek a čiarok v hodnotách
- Kódovanie: UTF-8`,
  },

  shopping: {
    label: "Nákupný zoznam",
    apiEndpoint: "/api/import/shopping",
    columns: [
      { key: "pantry_item", label: "Potravina", required: true, description: "Musí existovať v kuchyni" },
      { key: "quantity", label: "Množstvo", required: false, description: "Napr. 2l, 10ks, 500g" },
    ],
    exampleRows: [
      { pantry_item: "Mlieko", quantity: "2l" },
      { pantry_item: "Vajcia", quantity: "10ks" },
      { pantry_item: "Chlieb", quantity: "1ks" },
    ],
    botPrompt: `Vytvor CSV súbor s nákupným zoznamom. Formát:

pantry_item,quantity
Mlieko,2l
Vajcia,10ks
Chlieb,1ks
Maslo,250g
Ryža,1kg

Pravidlá:
- Prvý riadok musí byť hlavička: pantry_item,quantity
- pantry_item musí presne zodpovedať názvu potraviny z kuchyne
- quantity je množstvo (voliteľné)
- Kódovanie: UTF-8`,
  },

  recipes: {
    label: "Recepty",
    apiEndpoint: "/api/import/recipes",
    columns: [
      { key: "recipe_name", label: "Názov receptu", required: true },
      { key: "ingredient_name", label: "Ingrediencia", required: false, description: "Musí existovať v kuchyni" },
      { key: "quantity", label: "Množstvo", required: false },
    ],
    exampleRows: [
      { recipe_name: "Ranajky", ingredient_name: "Vajcia", quantity: "3 ks" },
      { recipe_name: "Ranajky", ingredient_name: "Chlieb", quantity: "2 krajce" },
      { recipe_name: "Omeleta", ingredient_name: "Vajcia", quantity: "4 ks" },
      { recipe_name: "Salat", ingredient_name: "Paradajky", quantity: "200g" },
    ],
    botPrompt: `Vytvor CSV súbor s receptami a ingredienciami. Formát:

recipe_name,ingredient_name,quantity
Ranajky,Vajcia,3 ks
Ranajky,Chlieb,2 krajce
Omeleta,Vajcia,4 ks
Omeleta,Mlieko,100ml
Salat,Paradajky,200g

Pravidlá:
- Jeden riadok = jedna ingrediencia v recepte
- Viac ingrediencií v recepte = viac riadkov s rovnakým recipe_name
- ingredient_name musí existovať v kuchyni (alebo nechaj prázdne pre recept bez ingrediencií)
- quantity je množstvo (voliteľné)
- Kódovanie: UTF-8`,
  },
};
