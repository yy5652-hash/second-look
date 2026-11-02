import { useState } from 'preact/hooks';
import { askBackAdvice, questions, type Answer, type Answers } from '../flows/askback';
const choices: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];
export function AskBack() {
  const [answers, setAnswers] = useState<Answers>({});
  const { state, advice } = askBackAdvice(answers);
  return (
    <section class="askback" aria-labelledby="askback-title">
      <h3 id="askback-title">Three quick questions before you trust it</h3>
      <p class="muted">The wording alone can’t settle this, but what it asks you to do can.</p>
      {questions.map((question) => (
        <fieldset class="askback-question">
          <legend>{question.text}</legend>
          <div class="askback-choices">
            {choices.map((choice) => (
              <label class={answers[question.id] === choice.value ? 'chosen' : ''}>
                <input
                  type="radio"
                  name={`askback-${question.id}`}
                  value={choice.value}
                  checked={answers[question.id] === choice.value}
                  onChange={() => setAnswers({ ...answers, [question.id]: choice.value })}
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div role="status" class={`askback-advice ${state}`}>
        {state === 'pause' && (
          <>
            <strong>Treat it as suspicious until you’ve checked.</strong>
            <ul>
              {advice.map((line) => (
                <li>{line}</li>
              ))}
            </ul>
          </>
        )}
        {state === 'quiet' && (
          <p>
            <strong>It isn’t asking you to do anything risky so far.</strong> You can leave it
            there. If it later asks for money, a code or a click, check again.
          </p>
        )}
      </div>
    </section>
  );
}
