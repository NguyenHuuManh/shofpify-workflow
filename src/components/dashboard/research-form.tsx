/**
 * Purpose:
 * Client component for the Product Research creation form with loading state.
 * Uses useFormStatus to show a spinner while the server action is pending.
 */

'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Card, Spinner } from '@/components/ui';
import {
  createResearchProject,
  startDiscoveryJob,
} from '@/app/dashboard/product-research/actions';

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner size={16} />
          Researching...
        </>
      ) : (
        'Run Research'
      )}
    </Button>
  );
}

function DiscoverySubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner size={16} />
          Starting...
        </>
      ) : (
        'Start AI Discovery Job'
      )}
    </Button>
  );
}

export function DiscoveryJobForm(): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card style={{ marginBottom: '24px' }}>
      <form
        ref={formRef}
        action={startDiscoveryJob}
        style={{
          display: 'grid',
          gap: '18px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <TextField
            id="seedQuery"
            name="seedQuery"
            label="Seed override"
            placeholder="Leave blank for DataForSEO discovery"
          />
          <TextField
            id="discoveryTargetMarket"
            name="discoveryTargetMarket"
            label="Market"
            defaultValue="US"
          />
          <TextField
            id="maxQueries"
            name="maxQueries"
            label="Query count"
            type="number"
            defaultValue="6"
          />
          <SelectField
            id="discoveryRiskTolerance"
            name="discoveryRiskTolerance"
            label="Risk"
            defaultValue="medium"
            options={[
              ['low', 'Low'],
              ['medium', 'Medium'],
              ['high', 'High'],
            ]}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <TextField
            id="discoveryPriceMin"
            name="discoveryPriceMin"
            label="Min price"
            type="number"
            placeholder="25"
          />
          <TextField
            id="discoveryPriceMax"
            name="discoveryPriceMax"
            label="Max price"
            type="number"
            placeholder="80"
          />
          <TextField
            id="discoveryTargetMarginPercent"
            name="discoveryTargetMarginPercent"
            label="Margin %"
            type="number"
            defaultValue="40"
          />
          <TextField
            id="discoveryMaxMoq"
            name="discoveryMaxMoq"
            label="Max MOQ"
            type="number"
            placeholder="500"
          />
          <TextField
            id="discoveryInternationalFreightPerUnit"
            name="discoveryInternationalFreightPerUnit"
            label="Freight"
            type="number"
            step="0.01"
            placeholder="8"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <ExcludedCategoryFields
            checkboxName="discoveryExcludedCategories"
            customId="discoveryExcludedCategoriesCustom"
            customName="discoveryExcludedCategoriesCustom"
          />
          <DiscoverySubmitButton />
        </div>

        <input type="hidden" name="discoveryAgentFeePercent" value="8" />
        <input type="hidden" name="discoveryCustomsDutyPercent" value="5" />
        <input type="hidden" name="discoveryPackagingPerUnit" value="1.5" />
        <input type="hidden" name="discoveryQcPerUnit" value="0.75" />
      </form>
    </Card>
  );
}

export function ResearchForm(): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card style={{ marginBottom: '24px' }}>
      <form
        ref={formRef}
        action={createResearchProject}
        style={{
          display: 'grid',
          gap: '18px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <TextField
            id="query"
            name="query"
            label="Product brief"
            required
            placeholder="pet travel accessories for US buyers..."
          />
          <TextField
            id="targetMarket"
            name="targetMarket"
            label="Market"
            defaultValue="US"
          />
          <SelectField
            id="objective"
            name="objective"
            label="Mode"
            defaultValue="find_winning_product"
            options={[
              ['find_winning_product', 'Find winners'],
              ['deep_sourcing', 'Deep sourcing'],
              ['validate_product', 'Validate idea'],
            ]}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <TextField id="priceMin" name="priceMin" label="Min price" type="number" placeholder="25" />
          <TextField id="priceMax" name="priceMax" label="Max price" type="number" placeholder="60" />
          <TextField
            id="targetMarginPercent"
            name="targetMarginPercent"
            label="Margin %"
            type="number"
            defaultValue="40"
          />
          <TextField id="maxMoq" name="maxMoq" label="Max MOQ" type="number" placeholder="500" />
          <TextField
            id="internationalFreightPerUnit"
            name="internationalFreightPerUnit"
            label="Freight"
            type="number"
            step="0.01"
            placeholder="8"
          />
          <SelectField
            id="riskTolerance"
            name="riskTolerance"
            label="Risk"
            defaultValue="medium"
            options={[
              ['low', 'Low'],
              ['medium', 'Medium'],
              ['high', 'High'],
            ]}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <ExcludedCategoryFields
            checkboxName="excludedCategories"
            customId="excludedCategoriesCustom"
            customName="excludedCategoriesCustom"
          />
          <SubmitButton />
        </div>

        <input type="hidden" name="agentFeePercent" value="8" />
        <input type="hidden" name="customsDutyPercent" value="5" />
        <input type="hidden" name="packagingPerUnit" value="1.5" />
        <input type="hidden" name="qcPerUnit" value="0.75" />
      </form>
    </Card>
  );
}

function ExcludedCategoryFields({
  checkboxName,
  customId,
  customName,
}: {
  checkboxName: string;
  customId: string;
  customName: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        alignItems: 'end',
        flex: '1 1 520px',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          ['fragile', 'Fragile'],
          ['electronics', 'Electronics'],
          ['regulated', 'Regulated'],
          ['oversized', 'Oversized'],
          ['trademark', 'Trademark risk'],
        ].map(([value, label]) => (
          <label
            key={value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <input type="checkbox" name={checkboxName} value={value} />
            {label}
          </label>
        ))}
      </div>
      <TextField
        id={customId}
        name={customName}
        label="Custom excludes"
        placeholder="supplements, adult, weapons"
      />
    </div>
  );
}

function TextField({
  id,
  name,
  label,
  type = 'text',
  required = false,
  defaultValue,
  placeholder,
  step,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  step?: string;
}): React.ReactElement {
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        style={fieldStyle}
      />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  options: Array<[string, string]>;
}): React.ReactElement {
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
      >
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} style={fieldStyle}>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
  background: '#fff',
};
