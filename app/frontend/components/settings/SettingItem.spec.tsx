import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingItem from './SettingItem';

describe('SettingItem Component', () => {
	describe('Toggle Type', () => {
		it('should render toggle switch', () => {
			render(<SettingItem label="Enable Feature" type="toggle" value={false} onChange={vi.fn()} />);

			expect(screen.getByRole('switch')).toBeInTheDocument();
			expect(screen.getByText('Enable Feature')).toBeInTheDocument();
		});

		it('should call onChange when toggled', () => {
			const onChange = vi.fn();
			render(
				<SettingItem label="Enable Feature" type="toggle" value={false} onChange={onChange} />
			);

			const toggle = screen.getByRole('switch');
			fireEvent.click(toggle);

			expect(onChange).toHaveBeenCalledWith(true);
		});

		it('should show description if provided', () => {
			render(
				<SettingItem
					label="Enable Feature"
					description="This enables a special feature"
					type="toggle"
					value={false}
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByText('This enables a special feature')).toBeInTheDocument();
		});
	});

	describe('Slider Type', () => {
		it('should render slider with range', () => {
			render(
				<SettingItem
					label="Volume"
					type="slider"
					value={50}
					min={0}
					max={100}
					step={1}
					onChange={vi.fn()}
				/>
			);

			const slider = screen.getByRole('slider');
			expect(slider).toBeInTheDocument();
			expect(slider).toHaveAttribute('min', '0');
			expect(slider).toHaveAttribute('max', '100');
			expect(slider).toHaveValue('50');
		});

		it('should display current value', () => {
			render(
				<SettingItem
					label="Volume"
					type="slider"
					value={75}
					min={0}
					max={100}
					unit="%"
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByText('75%')).toBeInTheDocument();
		});

		it('should call onChange when slider moves', () => {
			const onChange = vi.fn();
			render(
				<SettingItem
					label="Volume"
					type="slider"
					value={50}
					min={0}
					max={100}
					onChange={onChange}
				/>
			);

			const slider = screen.getByRole('slider');
			fireEvent.input(slider, { target: { value: '75' } });

			expect(onChange).toHaveBeenCalledWith(75);
		});
	});

	describe('Select Type', () => {
		it('should render select dropdown', () => {
			const options = [
				{ value: 'small', label: '小' },
				{ value: 'medium', label: '中' },
				{ value: 'large', label: '大' }
			];

			render(
				<SettingItem
					label="Font Size"
					type="select"
					value="medium"
					options={options}
					onChange={vi.fn()}
				/>
			);

			const select = screen.getByRole('combobox');
			expect(select).toBeInTheDocument();
			expect(select).toHaveValue('medium');
		});

		it('should display all options', () => {
			const options = [
				{ value: 'light', label: 'ライト' },
				{ value: 'dark', label: 'ダーク' },
				{ value: 'auto', label: '自動' }
			];

			render(
				<SettingItem
					label="Theme"
					type="select"
					value="auto"
					options={options}
					onChange={vi.fn()}
				/>
			);

			const select = screen.getByRole('combobox');
			const optionElements = select.querySelectorAll('option');
			expect(optionElements).toHaveLength(3);
		});

		it('should call onChange when selection changes', () => {
			const onChange = vi.fn();
			const options = [
				{ value: 'JIS', label: 'JIS配列' },
				{ value: 'US', label: 'US配列' }
			];

			render(
				<SettingItem
					label="Keyboard Layout"
					type="select"
					value="JIS"
					options={options}
					onChange={onChange}
				/>
			);

			const select = screen.getByRole('combobox');
			fireEvent.change(select, { target: { value: 'US' } });

			expect(onChange).toHaveBeenCalledWith('US');
		});
	});

	describe('Radio Type', () => {
		it('should render radio button group', () => {
			const options = [
				{ value: 'sequential', label: '順番' },
				{ value: 'random', label: 'ランダム' },
				{ value: 'weak-first', label: '苦手札優先' }
			];

			render(
				<SettingItem
					label="Order"
					type="radio"
					value="sequential"
					options={options}
					onChange={vi.fn()}
				/>
			);

			const radios = screen.getAllByRole('radio');
			expect(radios).toHaveLength(3);
			expect(radios[0]).toBeChecked();
		});

		it('should call onChange when radio is selected', () => {
			const onChange = vi.fn();
			const options = [
				{ value: 'beginner', label: '初級' },
				{ value: 'intermediate', label: '中級' },
				{ value: 'advanced', label: '上級' }
			];

			render(
				<SettingItem
					label="Difficulty"
					type="radio"
					value="beginner"
					options={options}
					onChange={onChange}
				/>
			);

			const radios = screen.getAllByRole('radio');
			fireEvent.click(radios[1]);

			expect(onChange).toHaveBeenCalledWith('intermediate');
		});
	});

	describe('Disabled State', () => {
		it('should disable toggle when disabled prop is true', () => {
			render(
				<SettingItem
					label="Disabled Setting"
					type="toggle"
					value={false}
					disabled={true}
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByRole('switch')).toBeDisabled();
		});

		it('should disable slider when disabled', () => {
			render(
				<SettingItem
					label="Disabled Slider"
					type="slider"
					value={50}
					min={0}
					max={100}
					disabled={true}
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByRole('slider')).toBeDisabled();
		});
	});

	describe('Validation', () => {
		it('should show error message when validation fails', () => {
			render(
				<SettingItem
					label="Number Input"
					type="slider"
					value={150}
					min={0}
					max={100}
					error="Value must be between 0 and 100"
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByText('Value must be between 0 and 100')).toBeInTheDocument();
			expect(screen.getByText('Value must be between 0 and 100')).toHaveClass('text-red-500');
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(
				<SettingItem
					label="Accessible Setting"
					type="toggle"
					value={false}
					ariaLabel="Toggle accessible setting"
					onChange={vi.fn()}
				/>
			);

			expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Toggle accessible setting');
		});

		it('should associate label with input', () => {
			render(
				<SettingItem
					label="Labeled Setting"
					type="slider"
					value={50}
					min={0}
					max={100}
					onChange={vi.fn()}
				/>
			);

			const slider = screen.getByRole('slider');
			const label = screen.getByText('Labeled Setting');

			// Check if label is properly associated
			expect(label.tagName).toBe('LABEL');
			expect(slider).toHaveAttribute('id');
		});
	});
});
