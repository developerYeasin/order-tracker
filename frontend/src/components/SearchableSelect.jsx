import React from 'react'
import Select, { defaultTheme } from 'react-select'

// Custom dark theme for react-select - safe handling for both v5 and older versions
const baseTheme = defaultTheme || (Select.defaultTheme ? Select.defaultTheme : {})

const darkTheme = {
  ...baseTheme,
  colors: {
    ...(baseTheme.colors || {}),
    primary25: 'rgba(59, 130, 246, 0.1)', // hover bg
    primary: '#3b82f6', // primary color
    primary50: 'rgba(59, 130, 246, 0.2)',
    primary75: 'rgba(59, 130, 246, 0.3)',
  },
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder = "Search...",
  isDisabled = false,
  className = "",
  filterOption = (option, input) => {
    // Case-insensitive search on label
    if (!input) return true
    return option.label.toLowerCase().includes(input.toLowerCase())
  }
}) => {
  // Convert options to react-select format if they're in {id, name} format
  const formattedOptions = options.map(opt => ({
    value: opt.id || opt.value || opt,
    label: opt.name || opt.label || opt,
    ...opt
  }))

  const selectedValue = formattedOptions.find(opt => opt.value === value) || null

  return (
    <Select
      value={selectedValue}
      onChange={(selected) => {
        onChange(selected ? selected.value : '')
      }}
      options={formattedOptions}
      placeholder={placeholder}
      isDisabled={isDisabled}
      className={className}
      classNamePrefix="searchable-select"
      theme={darkTheme}
      filterOption={filterOption}
      styles={{
        control: (provided) => ({
          ...provided,
          backgroundColor: '#1f2937', // bg-dark-700
          borderColor: '#374151', // border-dark-600
          color: '#ffffff',
          '&:hover': {
            borderColor: '#3b82f6', // border-primary-500
          },
          '&:focus': {
            borderColor: '#3b82f6',
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
          },
        }),
        menu: (provided) => ({
          ...provided,
          backgroundColor: '#1f2937',
          borderColor: '#374151',
          zIndex: 50,
        }),
        option: (provided, state) => ({
          ...provided,
          backgroundColor: state.isFocused
            ? '#3b82f6'
            : state.isSelected
            ? '#1d4ed8'
            : '#1f2937',
          color: '#ffffff',
          '&:active': {
            backgroundColor: '#3b82f6',
          },
        }),
        singleValue: (provided) => ({
          ...provided,
          color: '#ffffff',
        }),
        input: (provided) => ({
          ...provided,
          color: '#ffffff',
        }),
        placeholder: (provided) => ({
          ...provided,
          color: '#9ca3af',
        }),
        dropdownIndicator: (provided) => ({
          ...provided,
          color: '#9ca3af',
        }),
        clearIndicator: (provided) => ({
          ...provided,
          color: '#9ca3af',
        }),
        indicatorSeparator: (provided) => ({
          ...provided,
          backgroundColor: '#374151',
        }),
      }}
    />
  )
}

export default SearchableSelect
