import './styles.css';
import { Game } from './game/engine';
import { UI } from './ui/ui';

const ui = new UI(document.getElementById('app')!);

function startNew() {
  Game.clearSave();
  ui.attach(Game.newGame());
}

ui.onRestart = startNew;

const saved = Game.load();
ui.showIntro(
  !!saved,
  startNew,
  () => { if (saved) ui.attach(saved); },
);
// Vẽ một ván nền phía sau màn hình giới thiệu
ui.attach(saved ?? Game.newGame());

// Chỉ ở chế độ dev: mở cửa sổ debug trong console (window.__ui.game)
if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
  (window as unknown as Record<string, unknown>).__ui = ui;
  (window as unknown as Record<string, unknown>).__Game = Game;
}
