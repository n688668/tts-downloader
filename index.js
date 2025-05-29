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
    ],
  },
]);

if (answers.language === 'english') {
  runEnglish();
} else {
  runVietnamese();
}
