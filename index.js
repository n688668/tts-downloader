import inquirer from 'inquirer';
import runEnglish from './english.js';
import runVietnamese from './vietnamese.js';
import runVietnamesev2 from './vietnamesev2.js';
import runRename from './rename.js';

const answers = await inquirer.prompt([
  {
    type: 'list',
    name: 'language',
    message: 'Bạn muốn chạy file nào?',
    choices: [
      { name: 'English (text only)', value: 'english' },
      { name: 'Vietnamese (text only)', value: 'vietnamese' },
      { name: 'Vietnamese (text+slug)', value: 'vietnamesev2' },
      { name: 'Rename Files', value: 'rename' },
      new inquirer.Separator(),
      { name: 'Thoát', value: 'exit' },
    ],
  },
]);

if (answers.language === 'english') {
  runEnglish();
} else if (answers.language === 'vietnamese') {
  runVietnamese();
} else if (answers.language === 'vietnamesev2') {
  runVietnamesev2();
} else if (answers.language === 'rename') {
  runRename();
} else {
  console.log('👋 Tạm biệt!');
  process.exit(0);
}
