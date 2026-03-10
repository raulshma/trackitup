import { memo } from "react";

import { DynamicFormField } from "@/components/forms/DynamicFormField";
import { dynamicFormStyles as styles } from "@/components/forms/dynamicFormStyles";
import type { DynamicFormRendererProps } from "@/components/forms/dynamicFormTypes";
import { useDynamicFormTools } from "@/components/forms/useDynamicFormTools";
import { Text, View } from "@/components/Themed";

export const DynamicFormRenderer = memo(function DynamicFormRenderer({
  action,
  entry,
  errors,
  onChange,
  palette,
  readOnly = false,
  template,
  values,
  workspace,
}: DynamicFormRendererProps) {
  const tools = useDynamicFormTools({ onChange, readOnly, values });

  return (
    <View>
      {template.sections.map((section) => (
        <View key={section.id} style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.description ? (
            <Text style={[styles.sectionCopy, { color: palette.muted }]}>
              {section.description}
            </Text>
          ) : null}
          {section.fields.map((field) => (
            <DynamicFormField
              key={field.id}
              action={action}
              entry={entry}
              errors={errors}
              field={field}
              onChange={onChange}
              palette={palette}
              readOnly={readOnly}
              tools={tools}
              values={values}
              workspace={workspace}
            />
          ))}
        </View>
      ))}
    </View>
  );
});