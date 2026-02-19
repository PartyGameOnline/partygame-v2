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
  id: string; // ★ bigint安全のため string に統一（"0" 始まり）
  roomCode: string;
  event: E;
  clientId: string;
  eventId: string; // uuid
  createdAt?: string;
};

export interface EventSyncAdapter<E> {
  // ★ ページング対応（limitは実装側が上限を設定してもOK）
  loadAfter(roomCode: string, afterId: string, limit?: number): Promise<RemoteEventEnvelope<E>[]>;

  publish(roomCode: string, event: E): Promise<void>;

  subscribe(roomCode: string, cb: (envelope: RemoteEventEnvelope<E>) => void): () => void;

  getClientId(): string;
}

export type Snapshot<S> = {
  roomCode: string;
  lastEventId: string; // bigint安全: string ("0"~)
  state: S;
  createdAt?: string;
};

export interface SnapshotAdapter<S> {
  loadLatest(roomCode: string): Promise<Snapshot<S> | undefined>;
  saveSnapshot(roomCode: string, lastEventId: string, state: S): Promise<void>;
}
