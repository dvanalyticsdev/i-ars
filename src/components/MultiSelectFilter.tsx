import React from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  allLabel,
  options,
  selected,
  onChange,
  className = ''
}) => {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);
  const instanceId = React.useId();
  const selectedLabels = options
    .filter(option => selected.includes(option.value))
    .map(option => option.label);
  const buttonLabel = selected.length === 0
    ? allLabel
    : selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels.length} selected`;

  const toggleOption = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value]
    );
  };

  const handleToggle = () => {
    const details = detailsRef.current;
    if (!details?.open) return;
    document.querySelectorAll<HTMLDetailsElement>('details[data-multi-select-filter="true"]').forEach(item => {
      if (item.dataset.filterId !== instanceId) {
        item.open = false;
      }
    });
  };

  return (
    <details
      ref={detailsRef}
      data-multi-select-filter="true"
      data-filter-id={instanceId}
      onToggle={handleToggle}
      className={`group relative ${className}`}
    >
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-[#485d8b]/50 focus:outline-none focus:ring-2 focus:ring-[#485d8b]">
        <span className="flex min-w-0 items-center gap-2">
          <ListFilter className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
        <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
        <button
          type="button"
          onClick={() => onChange([])}
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
            selected.length === 0 ? 'bg-[#485d8b] text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            selected.length === 0 ? 'border-white bg-white text-[#485d8b]' : 'border-gray-300 bg-white text-transparent'
          }`}>
            <Check className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        </button>
        <div className="mt-1 max-h-56 overflow-y-auto">
          {options.map(option => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                  active ? 'bg-[#edf1f7] text-[#3c4d73]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  active ? 'border-[#485d8b] bg-[#485d8b] text-white' : 'border-gray-300 bg-white text-transparent'
                }`}>
                  <Check className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
};
