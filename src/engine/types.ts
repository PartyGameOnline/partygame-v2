// 共通型（ここだけを参照）
export type Reducer<S, E> = (state: Readonly<S>, event: E) => S;
export type Validator<S> = (state: S) => void | never;
export type EngineListener<S> = (state: Readonly<S>) => void;

export interface GameSpec<S, E> {
  initialState: () => S;
  reduce: Reducer<S, E>;
  validate?: Validator<S>;
}

export interface SyncAdapter<S, _E> {
  load(roomCode: string): Promise<S | undefined>;
  save(roomCode: string, state: S): Promise<void>;
  subscribe(roomCode: string, cb: (remote: S) => void): () => void;
}

export type RemoteEventEnvelope<E> = {
  id: number; // DBの連番
  roomCode: string;
  event: E;
  clientId: string;
  eventId: string; // uuid
  createdAt?: string;
};

export interface EventSyncAdapter<E> {
  loadAfter(roomCode: string, afterId: number): Promise<RemoteEventEnvelope<E>[]>;
  publish(roomCode: string, event: E): Promise<void>;
  subscribe(roomCode: string, cb: (envelope: RemoteEventEnvelope<E>) => void): () => void;
  getClientId(): string;
}
