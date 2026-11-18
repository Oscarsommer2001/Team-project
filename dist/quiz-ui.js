(function () {
  const quiz = window.ShoveQuiz;
  const profile = window.coachQuizProfile;
  const dialog = document.querySelector('#coach-quiz');
  if (!quiz || !profile || !dialog) return;

  const coachNames = {
    retriever: 'The Overly Supportive Golden Retriever',
    younger: 'Disappointed Younger You',
    coworker: 'Passive-Aggressive Coworker',
    mum: 'Angry Mum',
    sergeant: 'Drill Sergeant'
  };
  let answers = [];
  let questionIndex = 0;
  let result = null;
  let chosenTone = null;

  const prompt = dialog.querySelector('#quiz-prompt');
  const answersBox = dialog.querySelector('#quiz-answers');
  const nextButton = dialog.querySelector('#quiz-next');
  const backButton = dialog.querySelector('#quiz-back');
  const picker = dialog.querySelector('#quiz-coaches');

  function isAnswered(index) {
    const answer = answers[index];
    return Array.isArray(answer) ? answer.length > 0 : answer !== undefined;
  }

  function renderQuestion() {
    const question = quiz.questions[questionIndex];
    dialog.querySelector('#quiz-progress').value = questionIndex + 1;
    dialog.querySelector('#quiz-progress-label').textContent = `Question ${questionIndex + 1} of ${quiz.questions.length}`;
    prompt.textContent = question.prompt;
    answersBox.innerHTML = question.options.map(option => {
      const selected = Array.isArray(answers[questionIndex])
        ? answers[questionIndex].includes(option.value)
        : answers[questionIndex] === option.value;
      return `<button type="button" class="quiz-answer${selected ? ' selected' : ''}" data-answer="${option.value}" aria-pressed="${selected}">${option.label}</button>`;
    }).join('');
    backButton.disabled = questionIndex === 0;
    nextButton.disabled = !isAnswered(questionIndex);
    nextButton.textContent = questionIndex === quiz.questions.length - 1 ? 'See my coach' : 'Next';
    dialog.querySelector('#quiz-question-view').hidden = false;
    dialog.querySelector('#quiz-result-view').hidden = true;
    dialog.querySelector('#quiz-skip').hidden = false;
  }

  function renderCoachPicker() {
    picker.innerHTML = quiz.coachKeys.map(tone => {
      const selected = tone === chosenTone;
      return `<button type="button" class="quiz-coach${selected ? ' selected' : ''}" data-coach="${tone}" aria-pressed="${selected}"><img src="assets/${tone}.png" alt="" width="64" height="64"><span>${coachNames[tone]}</span><small>${quiz.coachKeys.indexOf(tone) + 1}/5</small></button>`;
    }).join('');
    dialog.querySelector('#quiz-coach-choice-label').hidden = false;
    picker.hidden = false;
  }

  function renderResult(showAll = false) {
    if (!result) result = quiz.scoreAnswers(answers);
    if (!chosenTone) chosenTone = result.tone;
    const style = answers.length ? result.humourStyle : 'dry';
    const level = answers.length ? result.meanness : 3;
    dialog.querySelector('#quiz-result-portrait').src = `assets/${chosenTone}.png`;
    dialog.querySelector('#quiz-result-portrait').alt = `${coachNames[chosenTone]} portrait`;
    dialog.querySelector('#quiz-result-name').textContent = coachNames[chosenTone];
    dialog.querySelector('#quiz-result-level').textContent = `Meanness ${level}/5 · ${style[0].toUpperCase()}${style.slice(1)} humour`;
    dialog.querySelector('#quiz-result-reason').textContent = answers.length ? result.reason : 'Skip defaults to level 3 and Dry humour. Choose the coach that fits you.';
    const sample = profile.preview(chosenTone, style);
    dialog.querySelector('#quiz-result-message').textContent = sample;
    dialog.querySelector('#quiz-question-view').hidden = true;
    dialog.querySelector('#quiz-result-view').hidden = false;
    dialog.querySelector('#quiz-skip').hidden = true;
    dialog.querySelector('#quiz-coaches-toggle').textContent = showAll ? 'Hide other coaches' : 'See all coaches';
    picker.hidden = !showAll;
    dialog.querySelector('#quiz-coach-choice-label').hidden = !showAll;
    dialog.querySelector('#quiz-accept').textContent = `Choose ${coachNames[chosenTone]}`;
    if (showAll) renderCoachPicker();
  }

  function open() {
    answers = [];
    questionIndex = 0;
    result = null;
    chosenTone = null;
    renderQuestion();
    if (!dialog.open) dialog.showModal();
  }

  answersBox.addEventListener('click', event => {
    const button = event.target.closest('[data-answer]');
    if (!button) return;
    const value = button.dataset.answer;
    const question = quiz.questions[questionIndex];
    if (question.type === 'sensitive') {
      const selected = new Set(answers[questionIndex] || []);
      if (value === 'none') {
        selected.clear();
        selected.add(value);
      } else {
        selected.delete('none');
        selected.has(value) ? selected.delete(value) : selected.add(value);
      }
      answers[questionIndex] = [...selected];
    } else {
      answers[questionIndex] = question.type === 'meanness' ? Number(value) : value;
    }
    renderQuestion();
  });

  backButton.addEventListener('click', () => {
    if (questionIndex > 0) {
      questionIndex -= 1;
      renderQuestion();
    }
  });

  nextButton.addEventListener('click', () => {
    if (!isAnswered(questionIndex)) return;
    if (questionIndex < quiz.questions.length - 1) {
      questionIndex += 1;
      renderQuestion();
      return;
    }
    result = quiz.scoreAnswers(answers);
    chosenTone = result.tone;
    renderResult();
  });

  dialog.querySelector('#quiz-skip').addEventListener('click', () => {
    answers = [];
    result = { tone: 'coworker', meanness: 3, humourStyle: 'dry', sensitiveTopics: [], reason: '' };
    chosenTone = 'coworker';
    renderResult(true);
  });

  dialog.querySelector('#quiz-coaches-toggle').addEventListener('click', event => {
    const showAll = picker.hidden;
    event.currentTarget.textContent = showAll ? 'Hide other coaches' : 'See all coaches';
    dialog.querySelector('#quiz-coach-choice-label').hidden = !showAll;
    picker.hidden = !showAll;
    if (showAll) renderCoachPicker();
  });

  picker.addEventListener('click', event => {
    const button = event.target.closest('[data-coach]');
    if (!button) return;
    chosenTone = button.dataset.coach;
    renderResult(!picker.hidden);
  });

  dialog.querySelector('#quiz-accept').addEventListener('click', () => {
    const selection = answers.length ? result : { ...result, tone: chosenTone };
    profile.save({ ...selection, tone: chosenTone });
    dialog.close();
  });

  document.querySelector('#retake-quiz').addEventListener('click', () => {
    document.querySelector('#profile-dialog').close();
    open();
  });

  window.ShoveQuizUI = { open };
  if (profile.shouldStart) open();
})();