import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { BuilderComponent } from './builder.component';
import { AnalysisComponent } from './analysis.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent, title: 'My decks · Riftbound' },
  { path: 'builder/new', component: BuilderComponent, canDeactivate: [(page: BuilderComponent) => page.canLeave()], title: 'Deck Builder · Riftbound' },
  { path: 'builder/:deckId', component: BuilderComponent, canDeactivate: [(page: BuilderComponent) => page.canLeave()], title: 'Deck Builder · Riftbound' },
  { path: 'analysis/:deckId', component: AnalysisComponent, title: 'Deck Analysis · Riftbound' },
  { path: '**', redirectTo: '' }
];
