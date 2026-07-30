import './styles.css';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('Missing #app root element');
}

app.dataset['scaffold'] = 'checkpoint-1';
