import inquirer from 'inquirer';
import runEnglish from './english.js';
import runVietnamese from './vietnamese.js';

const answers = await inquirer.prompt([
  {
    type: 'list',
    name: 'language',
    message: 'Bạn muốn chạy file nào?',
    choices: [
      { name: 'English', value: 'english' },
      { name: 'Vietnamese', value: 'vietnamese' },
      new inquirer.Separator(),
      { name: 'Thoát', value: 'exit' },
    ],
  },
]);

if (answers.language === 'english') {
  runEnglish();
} else if (answers.language === 'vietnamese') {
  runVietnamese();
} else {
  console.log('👋 Tạm biệt!');
  process.exit(0);
}
