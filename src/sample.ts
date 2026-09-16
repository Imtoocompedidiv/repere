import { makeDocument, type Workspace } from "./core/documents";
export async function exampleWorkspace(): Promise<Workspace> {
  const documents = await Promise.all([
    makeDocument(
      "Note de cadrage",
      `Projet de mobilité — données fictives

1. Contexte
Le projet vise à améliorer la mobilité tout en maîtrisant son budget.
Une attention particulière sera portée aux coûts d’exploitation et aux cofinancements.
Le périmètre couvre trois communes et leurs déplacements quotidiens.

2. Objectifs
Faciliter les déplacements vers les services publics.
Réduire les trajets individuels lorsque des alternatives sont disponibles.
Mesurer les résultats au moyen d’indicateurs partagés.

3. Calendrier
Le diagnostic sera présenté en novembre. Une décision suivra en décembre.`,
      "ex-cadrage",
    ),
    makeDocument(
      "Compte rendu",
      `Réunion de lancement — données fictives

Les participants souhaitent un diagnostic avant toute décision.
Le budget de mobilité devra distinguer les investissements et les charges annuelles.
Le suivi sera présenté chaque trimestre au comité de pilotage.

La consultation des usagers commencera après validation du périmètre.
Les résultats seront publiés dans un document accessible.`,
      "ex-reunion",
    ),
    makeDocument(
      "Budget prévisionnel",
      `Hypothèses de travail — données fictives

Le budget total proposé s’élève à 250 000 euros.
La mobilité représente 40 % du budget, soit 100 000 euros.
Ces hypothèses devront être confirmées par un chiffrage contradictoire.

Une réserve de 10 % est prévue pour les imprévus.
Les financements externes ne sont pas encore acquis.`,
      "ex-budget",
    ),
  ]);
  return { version: 1, documents, citations: [] };
}
