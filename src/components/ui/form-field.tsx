export function FormField({
	label,
	type = "text",
	value,
	onChange,
	placeholder,
	error,
	required,
	step,
}: {
	label: string;
	type?: string;
	value: string | number;
	onChange: (value: string) => void;
	placeholder?: string;
	error?: string;
	required?: boolean;
	step?: string;
}) {
	return (
		<div className="mb-4">
			<label className="block text-sm font-medium text-gray-700 mb-1">
				{label}
			</label>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "border-red-500" : "border-gray-300"}`}
				required={required}
				step={step}
			/>
			{error && (
				<p className="text-red-500 text-xs mt-1">
					{error}
				</p>
			)}
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
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	error?: string;
	required?: boolean;
}) {
	return (
		<div className="mb-4">
			<label className="block text-sm font-medium text-gray-700 mb-1">
				{label}
			</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "border-red-500" : "border-gray-300"}`}
				required={required}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
			{error && (
				<p className="text-red-500 text-xs mt-1">
					{error}
				</p>
			)}
		</div>
	);
}
