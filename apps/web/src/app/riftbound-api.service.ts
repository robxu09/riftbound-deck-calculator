import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Card {
  id: string;
  name: string;
  type: string;
  cost: number | null;
  text: string;
  setCode: string;
  power?: number | null;
  might?: number | null;
  domains?: string[];
  supertype?: string | null;
  rarity?: string | null;
}

export interface Format {
  id: string;
  name: string;
  maxDeckSize: number;
  minDeckSize: number;
  cardLimit: number;
}

export interface Deck {
  id: string;
  name: string;
  formatId: string;
}

export interface DeckVersion {
  id: string;
  deckId: string;
  cards: DeckCard[];
  notes?: string;
}

export interface DeckCard {
  cardId: string;
  quantity: number;
}

export interface DeckAnalysisRequest {
  deckId: string;
  formatId: string;
  analysisType?: string;
}

export interface DeckAnalysisResult {
  deckId: string;
  formatId: string;
  cardCount: number;
  uniqueCardCount: number;
  manaCurve: Record<string, number>;
  summary: string;
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class RiftboundApiService {
  private readonly apiUrl = 'http://localhost:8082/api';

  constructor(private http: HttpClient) {}

  getCards(): Observable<Card[]> {
    return this.http.get<Card[]>(`${this.apiUrl}/cards`);
  }

  getFormats(): Observable<Format[]> {
    return this.http.get<Format[]>(`${this.apiUrl}/formats`);
  }

  getDecks(): Observable<Deck[]> {
    return this.http.get<Deck[]>(`${this.apiUrl}/decks`);
  }

  getDeck(deckId: string): Observable<Deck> {
    return this.http.get<Deck>(`${this.apiUrl}/decks/${deckId}`);
  }

  deleteDeck(deckId: string): Observable<{ deleted: boolean }> {
    return this.http.post<{ deleted: boolean }>(`${this.apiUrl}/decks/${deckId}/delete`, {});
  }

  getDeckVersions(deckId: string): Observable<DeckVersion[]> {
    return this.http.get<DeckVersion[]>(`${this.apiUrl}/decks/${deckId}/versions`);
  }

  createDeck(payload: { name: string; formatId: string }): Observable<Deck> {
    return this.http.post<Deck>(`${this.apiUrl}/decks`, payload);
  }

  addDeckVersion(deckId: string, payload: { cards: DeckCard[]; notes?: string }): Observable<DeckVersion> {
    return this.http.post<DeckVersion>(`${this.apiUrl}/decks/${deckId}/versions`, payload);
  }

  analyzeDeck(payload: DeckAnalysisRequest): Observable<DeckAnalysisResult> {
    return this.http.post<DeckAnalysisResult>(`${this.apiUrl}/analysis`, payload);
  }
}
