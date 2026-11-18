(function (root) {
  const coachKeys = ['retriever', 'younger', 'coworker', 'mum', 'sergeant'];
  const humourStyles = ['wholesome', 'sarcastic', 'absurd', 'dry', 'dramatic'];
  const sensitiveTopics = ['health', 'body', 'studies', 'work', 'none'];
  const questions = [
    {
      prompt: 'It is 7 am and your alarm goes off. Which voice gets you out of bed?',
      type: 'meanness',
      options: [
        { label: 'You are doing amazing already. Let us take one tiny step!', value: 1 },
        { label: 'We said we would get up. I still believe we can.', value: 2 },
        { label: 'Your morning plan is still waiting. Please advise.', value: 3 },
        { label: 'Feet on the floor, now. You will thank yourself later.', value: 4 },
        { label: 'UP, RECRUIT! THE DAY IS NOT GOING TO START ITSELF!', value: 5 }
      ]
    },
    {
      prompt: 'A friend gently teases you for being late. What feels most motivating?',
      type: 'meanness',
      options: [
        { label: 'They are happy to see me whenever I arrive.', value: 1 },
        { label: 'A kind nudge and a fresh start.', value: 2 },
        { label: 'A witty reminder to check the clock next time.', value: 3 },
        { label: 'A direct call-out, then help making a plan.', value: 4 },
        { label: 'A loud countdown and a clear next step.', value: 5 }
      ]
    },
    {
      prompt: 'Pick the reminder you would actually follow.',
      type: 'meanness',
      options: [
        { label: 'No rush. Five minutes still count, and I am cheering for you.', value: 1 },
        { label: 'You wanted to do this. Want to start together?', value: 2 },
        { label: 'Friendly follow-up: this is still on your list.', value: 3 },
        { label: 'The task is waiting. Pick a time and do the first bit.', value: 4 },
        { label: 'MOVE OUT! START WITH ONE MINUTE. GO!', value: 5 }
      ]
    },
    {
      prompt: 'When you fall short of a goal, what helps you reset?',
      type: 'meanness',
      options: [
        { label: 'It happens. Let us make the next try easy.', value: 1 },
        { label: 'A little kindness and a reminder why I started.', value: 2 },
        { label: 'A dry joke, then a practical plan.', value: 3 },
        { label: 'Honesty about what got in the way, then action.', value: 4 },
        { label: 'A firm reset and one clear order to begin.', value: 5 }
      ]
    },
    {
      prompt: 'A cat ignores a treadmill. Pick the caption that makes you smile.',
      type: 'humour',
      options: [
        { label: 'Rest is part of the plan. You are doing great, little cat.', value: 'wholesome' },
        { label: 'Bold of the treadmill to assume this was a meeting.', value: 'sarcastic' },
        { label: 'The cat has appointed the treadmill Minister of Walking.', value: 'absurd' },
        { label: 'The cat has other plans.', value: 'dry' },
        { label: 'The treadmill waits. The cat refuses. A legend is born.', value: 'dramatic' }
      ]
    },
    {
      prompt: 'Your group chat sends a meme after you finish a task. Which one lands?',
      type: 'humour',
      options: [
        { label: 'A tiny celebration with an encouraging sticker.', value: 'wholesome' },
        { label: 'A very official certificate for doing the obvious.', value: 'sarcastic' },
        { label: 'A pigeon in a tiny hat, promoted to project manager.', value: 'absurd' },
        { label: 'A quiet nod. No caption needed.', value: 'dry' },
        { label: 'A heroic soundtrack for one checked box.', value: 'dramatic' }
      ]
    },
    {
      prompt: 'Which sentence made you smile?',
      type: 'humour',
      options: [
        { label: 'Small steps still move you forward.', value: 'wholesome' },
        { label: 'Look at you, making a plan and everything.', value: 'sarcastic' },
        { label: 'The houseplants have convened and approved your next step.', value: 'absurd' },
        { label: 'Begin. That is the plan.', value: 'dry' },
        { label: 'And so, the next chapter begins!', value: 'dramatic' }
      ]
    },
    {
      prompt: 'Anything your coach should never joke about?',
      type: 'sensitive',
      options: [
        { label: 'Health', value: 'health' },
        { label: 'Body', value: 'body' },
        { label: 'Studies', value: 'studies' },
        { label: 'Work', value: 'work' },
        { label: 'None of these', value: 'none' }
      ]
    }
  ];

  const styleAdditions = {
    wholesome: ' Every small step counts, and you have got this.',
    sarcastic: ' Well, look at us making a plan and everything.',
    absurd: ' A tiny committee of houseplants has been notified.',
    dry: ' One step at a time.',
    dramatic: ' And so, the next chapter begins!'
  };

  function scoreAnswers(answers) {
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      throw new TypeError('Answer all eight questions before scoring.');
    }

    const meannessAnswers = answers.slice(0, 4);
    if (meannessAnswers.some(value => !Number.isInteger(value) || value < 1 || value > 5)) {
      throw new TypeError('Meanness answers must be scores from 1 to 5.');
    }

    const styleAnswers = answers.slice(4, 7);
    if (styleAnswers.some(value => !humourStyles.includes(value))) {
      throw new TypeError('Choose a supported humour style for each humour question.');
    }

    const topics = answers[7];
    if (!Array.isArray(topics) || topics.length === 0 || topics.some(topic => !sensitiveTopics.includes(topic))) {
      throw new TypeError('Choose at least one sensitive topic option.');
    }

    const meanScore = meannessAnswers.reduce((total, value) => total + value, 0) / meannessAnswers.length;
    const meanness = Math.round(meanScore);
    const styleCounts = Object.fromEntries(humourStyles.map(style => [style, 0]));
    styleAnswers.forEach(style => { styleCounts[style] += 1; });
    const highestVotes = Math.max(...Object.values(styleCounts));
    const lastStyle = styleAnswers[styleAnswers.length - 1];
    const humourStyle = styleCounts[lastStyle] === highestVotes
      ? lastStyle
      : humourStyles.find(style => styleCounts[style] === highestVotes);

    return {
      tone: coachKeys[meanness - 1],
      meanness,
      humourStyle,
      sensitiveTopics: topics.includes('none') ? [] : [...new Set(topics)],
      reason: `Your answers point to level ${meanness} pressure and a ${humourStyle} sense of humour.`
    };
  }

  function styleMessage(message, style) {
    return message + (styleAdditions[style] || '');
  }

  const api = { coachKeys, humourStyles, questions, scoreAnswers, styleMessage };
  root.ShoveQuiz = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);