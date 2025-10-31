import { useEffect, useState } from 'react';

interface DateTimeFieldProps {
  id: string;
  label: string;
  value?: string | null;
  onChange: (isoString: string) => void;
  help?: string;
  disabled?: boolean;
}

function extractDatePart(iso?: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
}

function extractTimePart(iso?: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(11, 16);
}

function combineIso(datePart: string, timePart: string): string {
  if (!datePart || !timePart) return '';
  const candidate = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(candidate.getTime())) {
    return '';
  }
  return candidate.toISOString();
}

export function DateTimeField({
  id,
  label,
  value,
  onChange,
  help,
  disabled
}: DateTimeFieldProps) {
  const [datePart, setDatePart] = useState(() => extractDatePart(value));
  const [timePart, setTimePart] = useState(() => extractTimePart(value) || '19:00');

  useEffect(() => {
    setDatePart(extractDatePart(value));
    setTimePart(extractTimePart(value) || '19:00');
  }, [value]);

  function emit(nextDate: string, nextTime: string) {
    const iso = combineIso(nextDate, nextTime);
    onChange(iso);
  }

  return (
    <div className="field">
      <label htmlFor={`${id}-date`}>{label}</label>
      <div className="date-time-field">
        <input
          id={`${id}-date`}
          type="date"
          className="control"
          value={datePart}
          disabled={disabled}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDatePart(nextDate);
            emit(nextDate, timePart);
          }}
        />
        <input
          id={`${id}-time`}
          type="time"
          className="control"
          value={timePart}
          disabled={disabled}
          onChange={(event) => {
            const nextTime = event.target.value;
            setTimePart(nextTime);
            emit(datePart, nextTime);
          }}
        />
      </div>
      {help ? <p className="help">{help}</p> : null}
    </div>
  );
}
