"use client";

import { useId } from "react";

export function FormField({
	label,
	type = "text",
	value,
	onChange,
	placeholder,
	error,
	required,
	step,
	min,
	max,
	readOnly,
	id,
}: {
	label: string;
	type?: string;
	value: string | number;
	onChange: (value: string) => void;
	placeholder?: string;
	error?: string;
	required?: boolean;
	step?: string | number;
	min?: string | number;
	max?: string | number;
	readOnly?: boolean;
	id?: string;
}) {
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<div className="mb-4">
			<label htmlFor={inputId} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
				{label}
				{required && <span className="ml-1 text-rose-500" aria-label="wajib diisi">*</span>}
			</label>
			<input
				id={inputId}
				type={type}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={error ? `${inputId}-error` : undefined}
				className={`min-h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${error ? "border-rose-400" : "border-slate-200"}`}
				required={required}
				step={step}
				min={min}
				max={max}
				readOnly={readOnly}
			/>
			{error && <p id={`${inputId}-error`} className="mt-1 text-xs text-rose-600">{error}</p>}
		</div>
	);
}

export function FormSelect({
	label,
	value,
	onChange,
	options,
	error,
	required,
	disabled,
	id,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	error?: string;
	required?: boolean;
	disabled?: boolean;
	id?: string;
}) {
	const generatedId = useId();
	const selectId = id ?? generatedId;

	return (
		<div className="mb-4">
			<label htmlFor={selectId} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
				{label}
				{required && <span className="ml-1 text-rose-500" aria-label="wajib diisi">*</span>}
			</label>
			<select
				id={selectId}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={error ? `${selectId}-error` : undefined}
				className={`min-h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${error ? "border-rose-400" : "border-slate-200"}`}
				required={required}
				disabled={disabled}
			>
				{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
			</select>
			{error && <p id={`${selectId}-error`} className="mt-1 text-xs text-rose-600">{error}</p>}
		</div>
	);
}
