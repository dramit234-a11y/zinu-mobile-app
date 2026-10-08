'use client';

export function CityPicker({ cities, value, onChange }: { cities: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <label style={{ maxWidth: 260 }}>
      City
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
